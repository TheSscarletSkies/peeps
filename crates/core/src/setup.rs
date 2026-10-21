//! What is left before peeps can really help, for a once-a-day nudge until it's done.

/// The steps still missing, in the order worth doing them.
pub fn missing(claude_ready: bool, knows_you: bool, products: usize) -> Vec<&'static str> {
    let mut left = Vec::new();
    if !claude_ready {
        left.push("connect Claude Code");
    }
    if !knows_you {
        left.push("tell your helper about you");
    }
    if products == 0 {
        left.push("add a product");
    }
    left
}

/// "Connect Claude Code, then tell your helper about you." Nothing when all is done.
pub fn nudge(left: &[&str]) -> Option<String> {
    let (last, rest) = left.split_last()?;
    let text = if rest.is_empty() {
        (*last).to_owned()
    } else {
        format!("{}, then {last}", rest.join(", "))
    };
    let mut chars = text.chars();
    let first = chars.next()?.to_uppercase().collect::<String>();
    Some(format!("{first}{}.", chars.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_what_is_left_in_order() {
        assert_eq!(
            nudge(&missing(false, false, 0)).as_deref(),
            Some("Connect Claude Code, tell your helper about you, then add a product.")
        );
        assert_eq!(
            nudge(&missing(true, false, 2)).as_deref(),
            Some("Tell your helper about you.")
        );
        assert_eq!(nudge(&missing(true, true, 1)), None);
    }
}
