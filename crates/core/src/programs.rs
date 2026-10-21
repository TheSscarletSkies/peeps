//! Finding command-line programs like `claude` from an app started outside a terminal. Such an app
//! gets a bare PATH: on a Mac it misses Homebrew and npm folders, and on Windows npm installs
//! `claude.cmd`, which a plain `claude` doesn't match.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

/// Folders installers commonly use, searched after the PATH the app was given.
pub fn extra_dirs(home: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![
        home.join(".local/bin"),
        home.join(".claude/local"),
        home.join(".npm-global/bin"),
        home.join(".volta/bin"),
        home.join(".bun/bin"),
        home.join("bin"),
    ];
    if cfg!(windows) {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            dirs.push(PathBuf::from(appdata).join("npm"));
        }
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            dirs.push(PathBuf::from(&local).join("Programs").join("claude"));
            dirs.push(PathBuf::from(local).join("Volta").join("bin"));
        }
    } else {
        dirs.push(PathBuf::from("/opt/homebrew/bin"));
        dirs.push(PathBuf::from("/usr/local/bin"));
    }
    // Every Node version nvm installed, newest name last, since global npm tools live beside it.
    if let Ok(versions) = std::fs::read_dir(home.join(".nvm/versions/node")) {
        let mut found: Vec<PathBuf> = versions
            .flatten()
            .map(|entry| entry.path().join("bin"))
            .collect();
        found.sort();
        dirs.extend(found.into_iter().rev());
    }
    dirs
}

/// Every folder to look in: the app's PATH first, then the usual install folders.
pub fn search_dirs() -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect())
        .unwrap_or_default();
    for dir in extra_dirs(&home) {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

/// The file names a program can have here: `claude`, plus `claude.exe` and `claude.cmd` on Windows.
fn names(program: &str, windows: bool) -> Vec<String> {
    if !windows || Path::new(program).extension().is_some() {
        return vec![program.to_owned()];
    }
    let exts = std::env::var("PATHEXT").unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".into());
    let mut names: Vec<String> = exts
        .split(';')
        .filter(|ext| !ext.is_empty())
        .map(|ext| format!("{program}{}", ext.to_lowercase()))
        .collect();
    names.push(program.to_owned());
    names
}

/// Where `program` is, looking in `dirs`. A path with a folder in it is taken as given.
pub fn find_in(program: &str, dirs: &[PathBuf], windows: bool) -> Option<PathBuf> {
    let expanded = crate::paths::expand_home(program);
    if expanded.components().count() > 1 {
        return expanded.is_file().then_some(expanded);
    }
    let names = names(program, windows);
    dirs.iter()
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|candidate| candidate.is_file())
}

pub fn find(program: &str) -> Option<PathBuf> {
    find_in(program, &search_dirs(), cfg!(windows))
}

/// Runs a program without a window of its own. A windowed app on Windows would otherwise flash
/// an empty console for every agent or script it starts.
pub fn quietly(command: &mut std::process::Command) -> &mut std::process::Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// The PATH to hand a program we start, so tools it runs in turn, such as `node`, are found too.
pub fn path_for_children() -> Option<OsString> {
    std::env::join_paths(search_dirs()).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_programs_in_install_folders() {
        let home = tempfile::tempdir().unwrap();
        let bin = home.path().join(".local/bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join("claude"), "").unwrap();
        let dirs = extra_dirs(home.path());
        assert_eq!(find_in("claude", &dirs, false), Some(bin.join("claude")));
        assert_eq!(find_in("codex", &dirs, false), None);
    }

    #[test]
    fn windows_finds_npm_command_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("claude.cmd"), "").unwrap();
        let dirs = vec![dir.path().to_path_buf()];
        assert_eq!(
            find_in("claude", &dirs, true),
            Some(dir.path().join("claude.cmd"))
        );
        assert_eq!(find_in("claude", &dirs, false), None);
    }

    #[test]
    fn a_path_is_used_as_given() {
        let dir = tempfile::tempdir().unwrap();
        let program = dir.path().join("agent");
        std::fs::write(&program, "").unwrap();
        let given = program.display().to_string();
        assert_eq!(find_in(&given, &[], false), Some(program));
        assert_eq!(find_in("/nowhere/agent", &[], false), None);
    }
}
