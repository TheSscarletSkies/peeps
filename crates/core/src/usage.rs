//! Token usage read from Claude Code transcripts (`~/.claude/projects/**/*.jsonl`).

use std::collections::{BTreeMap, HashSet};
use std::fs::File;
use std::io::{self, BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use chrono::{DateTime, TimeDelta, Utc};
use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Usage {
    pub at: DateTime<Utc>,
    pub model: String,
    pub input: u64,
    pub output: u64,
    pub cache_read: u64,
    pub cache_write: u64,
}

impl Usage {
    pub fn total(&self) -> u64 {
        self.input + self.output + self.cache_read + self.cache_write
    }

    /// Tokens the model had in context when it produced this message.
    pub fn context(&self) -> u64 {
        self.input + self.cache_read + self.cache_write
    }
}

#[derive(Deserialize)]
struct Line {
    #[serde(rename = "type")]
    kind: String,
    timestamp: Option<DateTime<Utc>>,
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    message: Option<Message>,
}

#[derive(Deserialize)]
struct Message {
    id: Option<String>,
    model: Option<String>,
    usage: Option<Counts>,
}

#[derive(Deserialize)]
struct Counts {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
    #[serde(default)]
    cache_creation_input_tokens: u64,
}

/// Parses one transcript line. Streaming writes the same message several times, so a key is returned for de-duplication.
fn parse_line(text: &str) -> Option<(Option<String>, Usage)> {
    let line: Line = serde_json::from_str(text).ok()?;
    if line.kind != "assistant" {
        return None;
    }
    let message = line.message?;
    let counts = message.usage?;
    let key = message
        .id
        .map(|id| format!("{id}:{}", line.request_id.unwrap_or_default()));
    Some((
        key,
        Usage {
            at: line.timestamp?,
            model: message.model.unwrap_or_default(),
            input: counts.input_tokens,
            output: counts.output_tokens,
            cache_read: counts.cache_read_input_tokens,
            cache_write: counts.cache_creation_input_tokens,
        },
    ))
}

/// Reads a transcript incrementally, remembering how far it got.
#[derive(Debug)]
pub struct Transcript {
    path: PathBuf,
    offset: u64,
    seen: HashSet<String>,
    entries: Vec<Usage>,
}

impl Transcript {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            offset: 0,
            seen: HashSet::new(),
            entries: Vec::new(),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn entries(&self) -> &[Usage] {
        &self.entries
    }

    /// Reads lines appended since the last call. A partial last line is left for next time.
    pub fn refresh(&mut self) -> io::Result<()> {
        let mut file = File::open(&self.path)?;
        if file.metadata()?.len() < self.offset {
            *self = Self::new(self.path.clone());
        }
        file.seek(SeekFrom::Start(self.offset))?;
        let mut reader = BufReader::new(file);
        let mut line = String::new();
        loop {
            line.clear();
            let read = reader.read_line(&mut line)?;
            if read == 0 || !line.ends_with('\n') {
                break;
            }
            self.offset += read as u64;
            if let Some((key, usage)) = parse_line(&line) {
                if key.is_none_or(|key| self.seen.insert(key)) {
                    self.entries.push(usage);
                }
            }
        }
        Ok(())
    }
}

/// Transcript files (`<root>/<project>/<session>.jsonl`) modified after `since`.
pub fn recent_transcripts(root: &Path, since: SystemTime) -> io::Result<Vec<PathBuf>> {
    let mut found = Vec::new();
    for project in std::fs::read_dir(root)? {
        let project = project?.path();
        if !project.is_dir() {
            continue;
        }
        for file in std::fs::read_dir(&project)? {
            let file = file?;
            let path = file.path();
            let modified = file.metadata()?.modified()?;
            if path.extension().is_some_and(|ext| ext == "jsonl") && modified > since {
                found.push(path);
            }
        }
    }
    Ok(found)
}

/// The working directory a transcript was recorded in, from the first line that names one.
pub fn transcript_cwd(path: &Path) -> io::Result<Option<String>> {
    let reader = BufReader::new(File::open(path)?);
    for line in reader.lines().take(50) {
        let value: serde_json::Value = match serde_json::from_str(&line?) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if let Some(cwd) = value.get("cwd").and_then(serde_json::Value::as_str) {
            return Ok(Some(cwd.to_owned()));
        }
    }
    Ok(None)
}

/// Tokens per minute over the trailing `window`.
pub fn burn_rate(entries: &[Usage], now: DateTime<Utc>, window: TimeDelta) -> u64 {
    let minutes = window.num_minutes().max(1) as u64;
    let since = now - window;
    let total: u64 = entries
        .iter()
        .filter(|usage| usage.at > since && usage.at <= now)
        .map(Usage::total)
        .sum();
    total / minutes
}

/// Share of the context window used by the latest message, 0 to 1.
pub fn context_used(entries: &[Usage], window_tokens: u64) -> f32 {
    match entries.last() {
        Some(usage) if window_tokens > 0 => {
            (usage.context() as f32 / window_tokens as f32).clamp(0.0, 1.0)
        }
        _ => 0.0,
    }
}

pub fn totals_by_model<'a>(entries: impl IntoIterator<Item = &'a Usage>) -> BTreeMap<String, u64> {
    let mut totals = BTreeMap::new();
    for usage in entries {
        *totals.entry(usage.model.clone()).or_default() += usage.total();
    }
    totals
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn line(id: &str, at: &str, input: u64, output: u64) -> String {
        format!(
            r#"{{"type":"assistant","timestamp":"{at}","requestId":"r-{id}","message":{{"id":"{id}","model":"claude-test","usage":{{"input_tokens":{input},"output_tokens":{output},"cache_read_input_tokens":100,"cache_creation_input_tokens":0}}}}}}"#
        ) + "\n"
    }

    #[test]
    fn reads_incrementally_and_skips_duplicates() {
        let mut file = tempfile::NamedTempFile::new().unwrap();
        write!(file, "{}", line("m1", "2026-10-19T10:00:00Z", 10, 5)).unwrap();
        write!(file, "{}", line("m1", "2026-10-19T10:00:00Z", 10, 5)).unwrap();
        writeln!(
            file,
            "{{\"type\":\"user\",\"timestamp\":\"2026-10-19T10:00:01Z\"}}"
        )
        .unwrap();

        let mut transcript = Transcript::new(file.path());
        transcript.refresh().unwrap();
        assert_eq!(transcript.entries().len(), 1);
        assert_eq!(transcript.entries()[0].total(), 115);

        write!(file, "{}", line("m2", "2026-10-19T10:01:00Z", 20, 5)).unwrap();
        write!(file, "{{\"type\":\"assistant\"").unwrap();
        transcript.refresh().unwrap();
        assert_eq!(transcript.entries().len(), 2);

        writeln!(file, "}}").unwrap();
        transcript.refresh().unwrap();
        assert_eq!(transcript.entries().len(), 2);
    }

    #[test]
    fn computes_burn_rate_and_context() {
        let at = |minute: u32| format!("2026-10-19T10:{minute:02}:00Z").parse().unwrap();
        let usage = |minute, input| Usage {
            at: at(minute),
            model: "m".into(),
            input,
            output: 0,
            cache_read: 0,
            cache_write: 0,
        };
        let entries = vec![usage(0, 1_000), usage(8, 6_000), usage(9, 4_000)];
        assert_eq!(burn_rate(&entries, at(10), TimeDelta::minutes(5)), 2_000);
        assert!((context_used(&entries, 8_000) - 0.5).abs() < 1e-6);
        assert_eq!(context_used(&[], 8_000), 0.0);
    }

    #[test]
    fn finds_recent_transcripts_and_their_folder() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("-code-shop");
        std::fs::create_dir(&project).unwrap();
        let path = project.join("s1.jsonl");
        std::fs::write(
            &path,
            "{\"type\":\"summary\"}\n{\"type\":\"user\",\"cwd\":\"/code/shop\"}\n",
        )
        .unwrap();
        std::fs::write(project.join("notes.txt"), "").unwrap();

        let an_hour_ago = SystemTime::now() - std::time::Duration::from_secs(3_600);
        assert_eq!(
            recent_transcripts(root.path(), an_hour_ago).unwrap(),
            std::slice::from_ref(&path)
        );
        assert_eq!(
            transcript_cwd(&path).unwrap().as_deref(),
            Some("/code/shop")
        );
    }

    #[test]
    fn totals_group_by_model() {
        let usage = |model: &str, input| Usage {
            at: Utc::now(),
            model: model.into(),
            input,
            output: 0,
            cache_read: 0,
            cache_write: 0,
        };
        let entries = [usage("a", 1), usage("b", 2), usage("a", 3)];
        let totals = totals_by_model(&entries);
        assert_eq!(totals["a"], 4);
        assert_eq!(totals["b"], 2);
    }
}
