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

pub fn config_file() -> PathBuf {
    data_dir().join("config.toml")
}

pub fn database_file() -> PathBuf {
    data_dir().join("peeps.db")
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

#[cfg(test)]
mod tests {
    use super::*;

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
