//! Keeps computers in step through a folder the user already syncs, like iCloud Drive, OneDrive,
//! Dropbox or Google Drive. Nothing to host and no account: each computer writes only its own file
//! and reads the others', so the cloud never has two writers on one file.

use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::todos::TodoRecord;

/// What one computer shares.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFile {
    pub device: String,
    /// A name people recognise, like the computer's hostname.
    pub name: String,
    pub written_at: DateTime<Utc>,
    #[serde(default)]
    pub todos: Vec<TodoRecord>,
}

/// Where things live inside the chosen folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Layout {
    pub root: PathBuf,
}

impl Layout {
    pub fn new(folder: &Path) -> Self {
        Self {
            root: folder.join("peeps"),
        }
    }

    pub fn config(&self) -> PathBuf {
        self.root.join("config.toml")
    }

    pub fn devices(&self) -> PathBuf {
        self.root.join("devices")
    }

    fn device_file(&self, device: &str) -> PathBuf {
        self.devices().join(format!("{device}.json"))
    }

    /// Writes this computer's file in one step, so other computers never read half of it.
    pub fn write(&self, file: &DeviceFile) -> std::io::Result<()> {
        std::fs::create_dir_all(self.devices())?;
        let path = self.device_file(&file.device);
        let staging = path.with_extension("json.peeps-tmp");
        std::fs::write(&staging, serde_json::to_vec_pretty(file)?)?;
        std::fs::rename(&staging, &path)
    }

    /// Every other computer's file. Files still downloading or written by a newer peeps are skipped
    /// rather than stopping the rest.
    pub fn others(&self, me: &str) -> Vec<DeviceFile> {
        let Ok(entries) = std::fs::read_dir(self.devices()) else {
            return Vec::new();
        };
        entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
            .filter(|path| path.file_stem().is_some_and(|stem| stem != me))
            .filter_map(|path| std::fs::read(path).ok())
            .filter_map(|bytes| serde_json::from_slice(&bytes).ok())
            .collect()
    }
}

/// This computer's own settings, never synced: which folder to use.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Local {
    pub folder: Option<PathBuf>,
}

impl Local {
    pub fn read(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|text| toml::from_str(&text).ok())
            .unwrap_or_default()
    }

    pub fn write(&self, path: &Path) -> std::io::Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let text = toml::to_string(self).map_err(std::io::Error::other)?;
        std::fs::write(path, text)
    }
}

/// A stable id for this computer, made once and kept with its local settings.
pub fn device_id(path: &Path) -> std::io::Result<String> {
    if let Ok(existing) = std::fs::read_to_string(path) {
        let existing = existing.trim();
        if !existing.is_empty() {
            return Ok(existing.to_owned());
        }
    }
    let id = crate::todos::new_uid();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(path, &id)?;
    Ok(id)
}

/// What happens to the config when sync is turned on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Joined {
    /// This is the first computer: its settings now live in the folder.
    Started,
    /// Another computer got there first: its settings are used, and this one's are kept as a backup.
    Joined,
}

/// Points this computer at `folder`, moving or adopting the shared config.
pub fn join(folder: &Path, local_config: &Path) -> std::io::Result<Joined> {
    let layout = Layout::new(folder);
    std::fs::create_dir_all(layout.devices())?;
    if layout.config().exists() {
        if local_config.exists() {
            std::fs::copy(
                local_config,
                local_config.with_extension("before-sync.toml"),
            )?;
        }
        Ok(Joined::Joined)
    } else {
        if local_config.exists() {
            std::fs::copy(local_config, layout.config())?;
        } else {
            std::fs::write(layout.config(), "")?;
        }
        Ok(Joined::Started)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::todos::{TodoInput, TodoStore};

    fn file(device: &str, title: &str) -> DeviceFile {
        let store = TodoStore::in_memory().unwrap();
        store
            .add(
                &TodoInput {
                    title: title.into(),
                    ..TodoInput::default()
                },
                Utc::now(),
            )
            .unwrap();
        DeviceFile {
            device: device.into(),
            name: format!("{device} laptop"),
            written_at: Utc::now(),
            todos: store.records().unwrap(),
        }
    }

    #[test]
    fn each_computer_reads_the_others() {
        let dir = tempfile::tempdir().unwrap();
        let layout = Layout::new(dir.path());
        layout.write(&file("mac", "From the Mac")).unwrap();
        layout.write(&file("windows", "From Windows")).unwrap();
        // A file still downloading from the cloud is skipped, not fatal.
        std::fs::write(layout.devices().join("phone.json"), b"{\"devi").unwrap();

        let seen_by_mac = layout.others("mac");
        assert_eq!(seen_by_mac.len(), 1);
        assert_eq!(seen_by_mac[0].todos[0].todo.title, "From Windows");
        assert_eq!(layout.others("windows")[0].name, "mac laptop");
    }

    /// Older peeps also shared scheduled drafts and a ledger; their files still read.
    #[test]
    fn files_from_older_computers_still_read() {
        let old = r#"{
            "device": "mac",
            "name": "mac laptop",
            "writtenAt": "2026-10-19T09:00:00Z",
            "todos": [],
            "schedules": [{ "uid": "s1", "kind": "linkedin" }],
            "ledger": [{ "uid": "paypal:1", "product": "shop" }]
        }"#;
        let file: DeviceFile = serde_json::from_str(old).unwrap();
        assert_eq!(file.name, "mac laptop");
        assert!(file.todos.is_empty());
    }

    #[test]
    fn the_first_computer_brings_its_settings_and_the_next_one_joins() {
        let cloud = tempfile::tempdir().unwrap();
        let mac_home = tempfile::tempdir().unwrap();
        let windows_home = tempfile::tempdir().unwrap();
        let mac_config = mac_home.path().join("config.toml");
        let windows_config = windows_home.path().join("config.toml");
        std::fs::write(&mac_config, "[helper]\nname = \"Bao\"\n").unwrap();
        std::fs::write(&windows_config, "[helper]\nname = \"Other\"\n").unwrap();

        assert_eq!(join(cloud.path(), &mac_config).unwrap(), Joined::Started);
        let shared = Layout::new(cloud.path()).config();
        assert!(std::fs::read_to_string(&shared).unwrap().contains("Bao"));

        assert_eq!(join(cloud.path(), &windows_config).unwrap(), Joined::Joined);
        assert!(std::fs::read_to_string(&shared).unwrap().contains("Bao"));
        assert!(windows_home.path().join("config.before-sync.toml").exists());
    }

    #[test]
    fn local_settings_and_device_id_stick() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sync.toml");
        assert_eq!(Local::read(&path), Local::default());
        let local = Local {
            folder: Some(PathBuf::from(
                "/Users/m/Library/Mobile Documents/com~apple~CloudDocs",
            )),
        };
        local.write(&path).unwrap();
        assert_eq!(Local::read(&path), local);

        let id_path = dir.path().join("device");
        let id = device_id(&id_path).unwrap();
        assert_eq!(device_id(&id_path).unwrap(), id);
    }
}
