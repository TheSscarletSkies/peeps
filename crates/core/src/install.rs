//! Installing Claude Code for someone who has never opened a terminal: peeps opens one running
//! Anthropic's own installer, then starts Claude so they can sign in.

pub use crate::chat::Agent;

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
pub fn command(os: Os, agent: Agent) -> &'static str {
    match (agent, os) {
        // Codex comes from npm, which needs Node.js; on Windows that is PowerShell's npm too.
        (Agent::Codex, _) => "npm install -g @openai/codex",
        (_, Os::Windows) => "irm https://claude.ai/install.ps1 | iex",
        (_, Os::Mac | Os::Linux) => "curl -fsSL https://claude.ai/install.sh | bash",
    }
}

/// What the terminal runs: install, then sign in. Claude starts from where its installer puts it,
/// since a terminal opened before the install doesn't know the new folder yet; npm's global
/// folder is already on the PATH, so `codex` is found by name.
pub fn script(os: Os, agent: Agent) -> String {
    match (agent, os) {
        (Agent::Codex, Os::Windows) => format!(
            "{}; Write-Host ''; Write-Host 'Sign in with your ChatGPT account, then go back to peeps.'; codex login",
            command(os, agent)
        ),
        (Agent::Codex, Os::Mac | Os::Linux) => format!(
            "{} && echo && echo 'Sign in with your ChatGPT account, then go back to peeps.' && codex login",
            command(os, agent)
        ),
        (_, Os::Windows) => format!(
            "{}; Write-Host ''; Write-Host 'Sign in below, then go back to peeps.'; \
             & \"$env:USERPROFILE\\.local\\bin\\claude.exe\"",
            command(os, agent)
        ),
        (_, Os::Mac | Os::Linux) => format!(
            "{} && echo && echo 'Sign in below, then go back to peeps.' && ~/.local/bin/claude",
            command(os, agent)
        ),
    }
}

/// What the terminal runs to sign in again, with the program found where peeps found it. The
/// path is single-quoted, so the AppleScript keeps its quotes.
pub fn sign_in_script(os: Os, agent: Agent, program: &str) -> String {
    match (agent, os) {
        (Agent::Codex, Os::Windows) => format!("& '{program}' login"),
        (Agent::Codex, Os::Mac | Os::Linux) => format!("'{program}' login"),
        (_, Os::Windows) => format!(
            "Write-Host 'Type /login and press Enter to sign in, then go back to peeps.'; & '{program}'"
        ),
        (_, Os::Mac | Os::Linux) => format!(
            "echo 'Type /login and press Return to sign in, then go back to peeps.' && '{program}'"
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
        let mac = sign_in_script(Os::Mac, Agent::Claude, "/Users/m/.local/bin/claude");
        assert!(mac.ends_with("&& '/Users/m/.local/bin/claude'"));
        assert!(!mac.contains('"'));
        let windows = sign_in_script(Os::Windows, Agent::Claude, "C:\\Users\\m\\claude.exe");
        assert!(windows.contains("/login"));
        assert!(windows.ends_with("& 'C:\\Users\\m\\claude.exe'"));
    }

    #[test]
    fn each_platform_installs_then_signs_in() {
        let windows = script(Os::Windows, Agent::Claude);
        assert!(windows.starts_with("irm https://claude.ai/install.ps1 | iex;"));
        assert!(windows.ends_with(".local\\bin\\claude.exe\""));
        let mac = script(Os::Mac, Agent::Claude);
        assert!(mac.starts_with("curl -fsSL https://claude.ai/install.sh | bash &&"));
        assert!(mac.ends_with("~/.local/bin/claude"));
        assert!(!mac.contains('"'), "it goes inside an AppleScript string");
        assert!(mac_terminal(&mac).contains("do script \"curl"));
    }

    #[test]
    fn chatgpt_installs_codex_and_signs_in_with_it() {
        let mac = script(Os::Mac, Agent::Codex);
        assert!(mac.starts_with("npm install -g @openai/codex &&"));
        assert!(mac.ends_with("codex login"));
        assert!(!mac.contains('"'));
        assert!(script(Os::Windows, Agent::Codex).ends_with("codex login"));
        assert_eq!(
            sign_in_script(Os::Mac, Agent::Codex, "/opt/homebrew/bin/codex"),
            "'/opt/homebrew/bin/codex' login"
        );
    }
}
