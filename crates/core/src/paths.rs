use std::path::{Path, PathBuf};

/// Directory holding the config, database and socket. Overridable with `PEEPS_HOME`.
pub fn data_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("PEEPS_HOME") {
        return PathBuf::from(dir);
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".peeps")
}

/// The settings file: in the sync folder when the user turned sync on, otherwise kept locally.
pub fn config_file() -> PathBuf {
    match crate::sync::Local::read(&sync_settings_file()).folder {
        Some(folder) => crate::sync::Layout::new(&folder).config(),
        None => local_config_file(),
    }
}

pub fn local_config_file() -> PathBuf {
    data_dir().join("config.toml")
}

/// Which folder this computer syncs through. Never synced itself.
pub fn sync_settings_file() -> PathBuf {
    data_dir().join("sync.toml")
}

pub fn device_file() -> PathBuf {
    data_dir().join("device")
}

pub fn database_file() -> PathBuf {
    data_dir().join("peeps.db")
}

/// Where the helper's own agent runs, so its conversations and approvals stay apart from products.
pub fn assistant_dir() -> PathBuf {
    data_dir().join("assistant")
}

pub fn claude_settings_file() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude")
        .join("settings.json")
}

/// Expands a leading `~` to the home directory.
pub fn expand_home(path: &str) -> PathBuf {
    match path.strip_prefix('~') {
        Some(rest) => {
            let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            home.join(rest.trim_start_matches(['/', '\\']))
        }
        None => PathBuf::from(path),
    }
}

/// True when `path` is `root` or lies inside it, compared component by component.
pub fn is_within(path: &Path, root: &Path) -> bool {
    path.starts_with(root)
}

/// A file name safe on every platform: letters, digits and single dashes, with the extension kept.
pub fn safe_file_name(name: &str, extension: &str) -> String {
    let mut stem = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            stem.push(c.to_ascii_lowercase());
        } else if !stem.is_empty() && !stem.ends_with('-') {
            stem.push('-');
        }
    }
    let stem = stem.trim_end_matches('-');
    let stem = if stem.is_empty() { "peeps" } else { stem };
    format!("{stem}.{extension}")
}

/// `dir/name`, or `dir/name-2`, `dir/name-3`… when the name is taken.
pub fn unused_path(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let (stem, extension) = file_name.rsplit_once('.').unwrap_or((file_name, ""));
    (2..)
        .map(|n| dir.join(format!("{stem}-{n}.{extension}")))
        .find(|path| !path.exists())
        .expect("an unused name exists")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_tidy() {
        assert_eq!(
            safe_file_name("peeps week of Oct 19!", "png"),
            "peeps-week-of-oct-19.png"
        );
        assert_eq!(safe_file_name("../../etc/passwd", "png"), "etc-passwd.png");
        assert_eq!(safe_file_name("   ", "png"), "peeps.png");
    }

    #[test]
    fn unused_path_never_overwrites() {
        let dir = std::env::temp_dir().join(format!("peeps-unused-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(unused_path(&dir, "recap.png"), dir.join("recap.png"));
        std::fs::write(dir.join("recap.png"), b"").unwrap();
        assert_eq!(unused_path(&dir, "recap.png"), dir.join("recap-2.png"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn expands_tilde_prefix() {
        let home = dirs::home_dir().unwrap();
        assert_eq!(expand_home("~/code/app"), home.join("code/app"));
        assert_eq!(expand_home("/srv/app"), PathBuf::from("/srv/app"));
    }

    #[test]
    fn containment_is_by_component() {
        assert!(is_within(
            Path::new("/code/app/src"),
            Path::new("/code/app")
        ));
        assert!(is_within(Path::new("/code/app"), Path::new("/code/app")));
        assert!(!is_within(
            Path::new("/code/app-two"),
            Path::new("/code/app")
        ));
    }
}
