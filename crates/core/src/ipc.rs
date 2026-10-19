use std::io;

use interprocess::local_socket::{
    GenericFilePath, GenericNamespaced, Name, NameType, ToFsName, ToNsName,
};

use crate::paths;

const SOCKET: &str = "peeps.sock";

/// The local socket the app listens on: an abstract name where supported, otherwise a file in the data directory.
pub fn socket_name() -> io::Result<Name<'static>> {
    if GenericNamespaced::is_supported() {
        SOCKET.to_ns_name::<GenericNamespaced>()
    } else {
        paths::data_dir()
            .join(SOCKET)
            .to_fs_name::<GenericFilePath>()
    }
}

/// Removes a socket file left behind by a crashed app. A no-op for abstract names.
pub fn clear_stale_socket() -> io::Result<()> {
    if GenericNamespaced::is_supported() {
        return Ok(());
    }
    match std::fs::remove_file(paths::data_dir().join(SOCKET)) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}
