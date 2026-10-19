use peeps_core::checks::Secrets;

const SERVICE: &str = "peeps";

/// Secrets stored in the macOS Keychain, Windows Credential Manager or Secret Service.
pub struct Keychain;

impl Secrets for Keychain {
    fn get(&self, name: &str) -> Option<String> {
        keyring::Entry::new(SERVICE, name).ok()?.get_password().ok()
    }
}

pub fn set(name: &str, value: &str) -> keyring::Result<()> {
    keyring::Entry::new(SERVICE, name)?.set_password(value)
}

pub fn remove(name: &str) -> keyring::Result<()> {
    match keyring::Entry::new(SERVICE, name)?.delete_credential() {
        Err(keyring::Error::NoEntry) => Ok(()),
        other => other,
    }
}
