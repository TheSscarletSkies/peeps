//! Installing Claude Code for someone who has never opened a terminal: peeps opens one running
//! Anthropic's own installer, then starts Claude so they can sign in.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    Windows,
    Mac,
    Linux,
}

impl Os {
    pub fn current() -> Self {
        if cfg!(windows) {
            Self::Windows
        } else if cfg!(target_os = "macos") {
            Self::Mac
        } else {
            Self::Linux
        }
    }
}

/// The command a person would paste, shown as a fallback beside the button.
pub fn command(os: Os) -> &'static str {
    match os {
        Os::Windows => "irm https://claude.ai/install.ps1 | iex",
        Os::Mac | Os::Linux => "curl -fsSL https://claude.ai/install.sh | bash",
    }
}

/// What the terminal runs: install, then start Claude from where the installer puts it, since
/// a terminal opened before the install doesn't know the new folder yet.
pub fn script(os: Os) -> String {
    match os {
        Os::Windows => format!(
            "{}; Write-Host ''; Write-Host 'Sign in below, then go back to peeps.'; \
             & \"$env:USERPROFILE\\.local\\bin\\claude.exe\"",
            command(os)
        ),
        Os::Mac | Os::Linux => format!(
            "{} && echo && echo 'Sign in below, then go back to peeps.' && ~/.local/bin/claude",
            command(os)
        ),
    }
}

/// What the terminal runs to sign in again: Claude Code itself, found where peeps found it, with
/// a line saying what to type. The path is single-quoted, so the AppleScript keeps its quotes.
pub fn sign_in_script(os: Os, claude: &str) -> String {
    match os {
        Os::Windows => format!(
            "Write-Host 'Type /login and press Enter to sign in, then go back to peeps.'; & '{claude}'"
        ),
        Os::Mac | Os::Linux => format!(
            "echo 'Type /login and press Return to sign in, then go back to peeps.' && '{claude}'"
        ),
    }
}

/// AppleScript that opens Terminal on the script. It holds no double quotes, so it can sit
/// inside one AppleScript string as is.
pub fn mac_terminal(script: &str) -> String {
    format!("tell application \"Terminal\"\nactivate\ndo script \"{script}\"\nend tell")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signing_in_again_starts_the_claude_peeps_found() {
        let mac = sign_in_script(Os::Mac, "/Users/m/.local/bin/claude");
        assert!(mac.ends_with("&& '/Users/m/.local/bin/claude'"));
        assert!(!mac.contains('"'));
        let windows = sign_in_script(Os::Windows, "C:\\Users\\m\\claude.exe");
        assert!(windows.contains("/login"));
        assert!(windows.ends_with("& 'C:\\Users\\m\\claude.exe'"));
    }

    #[test]
    fn each_platform_installs_then_signs_in() {
        let windows = script(Os::Windows);
        assert!(windows.starts_with("irm https://claude.ai/install.ps1 | iex;"));
        assert!(windows.ends_with(".local\\bin\\claude.exe\""));
        let mac = script(Os::Mac);
        assert!(mac.starts_with("curl -fsSL https://claude.ai/install.sh | bash &&"));
        assert!(mac.ends_with("~/.local/bin/claude"));
        assert!(!mac.contains('"'), "it goes inside an AppleScript string");
        assert!(mac_terminal(&mac).contains("do script \"curl"));
    }
}
