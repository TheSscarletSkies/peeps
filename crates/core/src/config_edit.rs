//! Changes the config file in place, keeping the user's comments and layout.

use serde::Deserialize;
use toml_edit::{value, Array, ArrayOfTables, DocumentMut, InlineTable, Item, Table};

use crate::config::{Config, ConfigError, Pet, PetKind, Reminders};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProduct {
    pub name: String,
    pub path: String,
    pub kind: PetKind,
    pub color: String,
}

#[derive(Debug, thiserror::Error)]
pub enum EditError {
    #[error("the config file is not valid TOML: {0}")]
    Syntax(#[from] toml_edit::TomlError),
    #[error("`product` in the config file must be a list of [[product]] tables")]
    Shape,
    #[error("give the product a name")]
    EmptyName,
    #[error("choose the product's folder")]
    EmptyPath,
    #[error("no product with id `{0}`")]
    Unknown(String),
    #[error("give the calendar a name")]
    EmptyCalendar,
    #[error("there is already a calendar called `{0}`")]
    Duplicate(String),
    #[error("no calendar called `{0}`")]
    UnknownCalendar(String),
    #[error("`{0}` is not an email address peeps knows")]
    BadAddress(String),
    #[error(transparent)]
    Invalid(#[from] ConfigError),
}

/// Appends a product and returns the new file text with the id it was given.
pub fn add_product(text: &str, product: &NewProduct) -> Result<(String, String), EditError> {
    let name = product.name.trim();
    if name.is_empty() {
        return Err(EditError::EmptyName);
    }
    let path = product.path.trim();
    if path.is_empty() {
        return Err(EditError::EmptyPath);
    }
    let existing = Config::parse(text)?;
    let id = unique_id(&slug(name), &existing);

    let mut table = Table::new();
    table["id"] = value(id.as_str());
    table["name"] = value(name);
    let mut paths = Array::new();
    paths.push(path);
    table["paths"] = value(paths);
    let mut pet = InlineTable::new();
    pet.insert("kind", product.kind.as_str().into());
    pet.insert("color", color_or_default(&product.color).into());
    table["pet"] = value(pet);

    let mut doc: DocumentMut = text.parse()?;
    doc.entry("product")
        .or_insert(Item::ArrayOfTables(ArrayOfTables::new()))
        .as_array_of_tables_mut()
        .ok_or(EditError::Shape)?
        .push(table);

    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok((updated, id))
}

/// Removes the product with `id`, including its checks.
pub fn remove_product(text: &str, id: &str) -> Result<String, EditError> {
    let mut doc: DocumentMut = text.parse()?;
    let products = doc
        .get_mut("product")
        .and_then(Item::as_array_of_tables_mut)
        .ok_or_else(|| EditError::Unknown(id.to_owned()))?;
    let index = products
        .iter()
        .position(|table| table.get("id").and_then(Item::as_str) == Some(id))
        .ok_or_else(|| EditError::Unknown(id.to_owned()))?;
    products.remove(index);
    if products.is_empty() {
        doc.remove("product");
    }
    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok(updated)
}

/// A lowercase id made of letters, digits and dashes.
pub fn slug(name: &str) -> String {
    let mut slug = String::new();
    for c in name.chars().flat_map(char::to_lowercase) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
    }
    let slug = slug.trim_end_matches('-');
    if slug.is_empty() {
        "product".to_owned()
    } else {
        slug.to_owned()
    }
}

fn unique_id(base: &str, config: &Config) -> String {
    let taken = |id: &str| config.product(id).is_some();
    if !taken(base) {
        return base.to_owned();
    }
    (2..)
        .map(|n| format!("{base}-{n}"))
        .find(|id| !taken(id))
        .expect("an unused id exists")
}

fn color_or_default(color: &str) -> String {
    let hex = color.trim().trim_start_matches('#');
    if hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        format!("#{}", hex.to_ascii_uppercase())
    } else {
        Pet::default().color
    }
}

/// Adds a mail account. Its app password goes in the keychain, not here.
pub fn add_mail(text: &str, account: &crate::mail::Account) -> Result<String, EditError> {
    let address = account.address.trim().to_lowercase();
    if !address.contains('@') {
        return Err(EditError::BadAddress(address));
    }
    let existing = Config::parse(text)?;
    if existing
        .mail
        .iter()
        .any(|known| known.address.eq_ignore_ascii_case(&address))
    {
        return Err(EditError::Duplicate(address));
    }
    let mut table = Table::new();
    table["address"] = value(&address);
    table["provider"] = value(match account.provider {
        crate::mail::Provider::Gmail => "gmail",
        crate::mail::Provider::Icloud => "icloud",
    });
    if !account.name.trim().is_empty() {
        table["name"] = value(account.name.trim());
    }
    let login = account.login.trim().to_lowercase();
    if !login.is_empty() && login != address {
        if !login.contains('@') {
            return Err(EditError::BadAddress(login));
        }
        table["login"] = value(login);
    }
    let mut doc: DocumentMut = text.parse()?;
    doc.entry("mail")
        .or_insert(Item::ArrayOfTables(ArrayOfTables::new()))
        .as_array_of_tables_mut()
        .ok_or(EditError::Shape)?
        .push(table);
    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok(updated)
}

pub fn remove_mail(text: &str, address: &str) -> Result<String, EditError> {
    let mut doc: DocumentMut = text.parse()?;
    let accounts = doc
        .get_mut("mail")
        .and_then(Item::as_array_of_tables_mut)
        .ok_or_else(|| EditError::BadAddress(address.to_owned()))?;
    let index = accounts
        .iter()
        .position(|table| {
            table
                .get("address")
                .and_then(Item::as_str)
                .is_some_and(|known| known.eq_ignore_ascii_case(address))
        })
        .ok_or_else(|| EditError::BadAddress(address.to_owned()))?;
    accounts.remove(index);
    if accounts.is_empty() {
        doc.remove("mail");
    }
    Ok(doc.to_string())
}

/// Adds this computer's folder to a product another computer created, so both share one pet.
pub fn add_path(text: &str, id: &str, path: &str) -> Result<String, EditError> {
    let path = path.trim();
    if path.is_empty() {
        return Err(EditError::EmptyPath);
    }
    let mut doc: DocumentMut = text.parse()?;
    let product = doc
        .get_mut("product")
        .and_then(Item::as_array_of_tables_mut)
        .and_then(|products| {
            products
                .iter_mut()
                .find(|table| table.get("id").and_then(Item::as_str) == Some(id))
        })
        .ok_or_else(|| EditError::Unknown(id.to_owned()))?;
    let paths = product
        .entry("paths")
        .or_insert(value(Array::new()))
        .as_array_mut()
        .ok_or(EditError::Shape)?;
    if !paths.iter().any(|existing| existing.as_str() == Some(path)) {
        paths.push(path);
    }
    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok(updated)
}

/// Sets the helper's model and effort; `None` clears them so the agent's own defaults apply.
pub fn set_helper_agent(
    text: &str,
    model: Option<&str>,
    effort: Option<&str>,
) -> Result<String, EditError> {
    let mut doc: DocumentMut = text.parse()?;
    let helper = doc
        .entry("helper")
        .or_insert(Item::Table(Table::new()))
        .as_table_mut()
        .ok_or(EditError::Shape)?;
    for (key, choice) in [("model", model), ("effort", effort)] {
        match choice.map(str::trim).filter(|value| !value.is_empty()) {
            Some(value) => helper[key] = value.into(),
            None => {
                helper.remove(key);
            }
        }
    }
    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok(updated)
}

/// The keychain entry that holds a calendar's private link.
pub fn calendar_secret(name: &str) -> String {
    format!("calendar-{}", slug(name))
}

/// Adds a calendar whose link lives in the keychain under [`calendar_secret`].
pub fn add_calendar(
    text: &str,
    name: &str,
    remind_minutes: Option<i64>,
) -> Result<String, EditError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(EditError::EmptyCalendar);
    }
    let existing = Config::parse(text)?;
    if existing
        .calendars
        .iter()
        .any(|feed| feed.name.eq_ignore_ascii_case(name))
    {
        return Err(EditError::Duplicate(name.to_owned()));
    }

    let mut table = Table::new();
    table["name"] = value(name);
    table["url"] = value(format!("{{secret:{}}}", calendar_secret(name)));
    if let Some(minutes) = remind_minutes {
        table["remind_minutes"] = value(minutes);
    }

    let mut doc: DocumentMut = text.parse()?;
    doc.entry("calendar")
        .or_insert(Item::ArrayOfTables(ArrayOfTables::new()))
        .as_array_of_tables_mut()
        .ok_or(EditError::Shape)?
        .push(table);
    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok(updated)
}

pub fn remove_calendar(text: &str, name: &str) -> Result<String, EditError> {
    let mut doc: DocumentMut = text.parse()?;
    let calendars = doc
        .get_mut("calendar")
        .and_then(Item::as_array_of_tables_mut)
        .ok_or_else(|| EditError::UnknownCalendar(name.to_owned()))?;
    let index = calendars
        .iter()
        .position(|table| table.get("name").and_then(Item::as_str) == Some(name))
        .ok_or_else(|| EditError::UnknownCalendar(name.to_owned()))?;
    calendars.remove(index);
    if calendars.is_empty() {
        doc.remove("calendar");
    }
    Ok(doc.to_string())
}

/// Replaces the default lead time and the keyword rules.
pub fn set_reminders(text: &str, reminders: &Reminders) -> Result<String, EditError> {
    let mut doc: DocumentMut = text.parse()?;
    let mut table = Table::new();
    table["default_minutes"] = value(reminders.default_minutes);
    let mut rules = ArrayOfTables::new();
    for rule in reminders
        .rules
        .iter()
        .filter(|rule| !rule.contains.trim().is_empty())
    {
        let mut entry = Table::new();
        entry["contains"] = value(rule.contains.trim());
        entry["minutes"] = value(rule.minutes);
        if rule.mute {
            entry["mute"] = value(true);
        }
        rules.push(entry);
    }
    if !rules.is_empty() {
        table["rule"] = Item::ArrayOfTables(rules);
    }
    doc["reminders"] = Item::Table(table);
    let updated = doc.to_string();
    Config::parse(&updated)?;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop() -> NewProduct {
        NewProduct {
            name: "My Shop!".into(),
            path: "~/code/shop".into(),
            kind: PetKind::Gyoza,
            color: "ffd66b".into(),
        }
    }

    #[test]
    fn adds_a_product_and_keeps_comments() {
        let text = "# my settings\n[settings]\nsweat_after_minutes = 20 # quick\n";
        let (updated, id) = add_product(text, &shop()).unwrap();
        assert_eq!(id, "my-shop");
        assert!(
            updated.starts_with("# my settings\n[settings]\nsweat_after_minutes = 20 # quick\n")
        );

        let config = Config::parse(&updated).unwrap();
        let product = config.product("my-shop").unwrap();
        assert_eq!(product.name, "My Shop!");
        assert_eq!(product.paths, ["~/code/shop"]);
        assert_eq!(product.pet.kind, PetKind::Gyoza);
        assert_eq!(product.pet.color, "#FFD66B");
    }

    #[test]
    fn gives_repeated_names_unique_ids() {
        let (once, _) = add_product("", &shop()).unwrap();
        let (twice, id) = add_product(&once, &shop()).unwrap();
        assert_eq!(id, "my-shop-2");
        assert_eq!(Config::parse(&twice).unwrap().products.len(), 2);
    }

    #[test]
    fn rejects_missing_fields() {
        let blank_name = NewProduct {
            name: "  ".into(),
            ..shop()
        };
        assert!(matches!(
            add_product("", &blank_name),
            Err(EditError::EmptyName)
        ));
        let blank_path = NewProduct {
            path: "".into(),
            ..shop()
        };
        assert!(matches!(
            add_product("", &blank_path),
            Err(EditError::EmptyPath)
        ));
    }

    #[test]
    fn falls_back_to_the_default_colour() {
        let odd = NewProduct {
            color: "red".into(),
            ..shop()
        };
        let (updated, id) = add_product("", &odd).unwrap();
        let config = Config::parse(&updated).unwrap();
        assert_eq!(config.product(&id).unwrap().pet.color, Pet::default().color);
    }

    #[test]
    fn removes_a_product() {
        let (one, first) = add_product("", &shop()).unwrap();
        let (two, _) = add_product(&one, &shop()).unwrap();
        let back = remove_product(&two, &first).unwrap();
        let config = Config::parse(&back).unwrap();
        assert_eq!(config.products.len(), 1);
        assert_eq!(config.products[0].id, "my-shop-2");

        let empty = remove_product(&one, &first).unwrap();
        assert!(Config::parse(&empty).unwrap().products.is_empty());
        assert!(matches!(
            remove_product(&one, "nope"),
            Err(EditError::Unknown(_))
        ));
    }

    #[test]
    fn slugs() {
        assert_eq!(slug("Enigma Archives"), "enigma-archives");
        assert_eq!(slug("  Kaiveni   Hiya!! "), "kaiveni-hiya");
        assert_eq!(slug("☕"), "product");
    }

    #[test]
    fn calendars_keep_their_links_in_the_keychain() {
        let text = add_calendar("", "College Gmail", Some(30)).unwrap();
        let config = Config::parse(&text).unwrap();
        assert_eq!(config.calendars[0].url, "{secret:calendar-college-gmail}");
        assert_eq!(config.calendars[0].remind_minutes, Some(30));
        assert!(matches!(
            add_calendar(&text, "college gmail", None),
            Err(EditError::Duplicate(_))
        ));
        let removed = remove_calendar(&text, "College Gmail").unwrap();
        assert!(Config::parse(&removed).unwrap().calendars.is_empty());
    }

    #[test]
    fn reminder_rules_round_trip() {
        use crate::config::ReminderRule;
        let reminders = Reminders {
            default_minutes: 10,
            rules: vec![
                ReminderRule {
                    contains: " class ".into(),
                    minutes: 30,
                    mute: false,
                },
                ReminderRule {
                    contains: "".into(),
                    minutes: 5,
                    mute: false,
                },
                ReminderRule {
                    contains: "focus".into(),
                    minutes: 0,
                    mute: true,
                },
            ],
        };
        let text = set_reminders("# mine\n[settings]\n", &reminders).unwrap();
        assert!(text.starts_with("# mine"));
        let parsed = Config::parse(&text).unwrap().reminders;
        assert_eq!(parsed.default_minutes, 10);
        assert_eq!(parsed.rules.len(), 2);
        assert_eq!(parsed.rules[0].contains, "class");
        assert!(parsed.rules[1].mute);
        let again = set_reminders(&text, &Reminders::default()).unwrap();
        assert!(Config::parse(&again).unwrap().reminders.rules.is_empty());
    }

    #[test]
    fn helper_model_and_effort_can_be_set_and_cleared() {
        let text =
            set_helper_agent("[helper]\nname = \"Bao\"\n", Some("opus"), Some("high")).unwrap();
        let helper = Config::parse(&text).unwrap().helper;
        assert_eq!(helper.name, "Bao");
        assert_eq!(helper.model.as_deref(), Some("opus"));
        assert_eq!(helper.effort.as_deref(), Some("high"));
        let cleared = set_helper_agent(&text, None, Some(" ")).unwrap();
        let helper = Config::parse(&cleared).unwrap().helper;
        assert_eq!(helper.model, None);
        assert_eq!(helper.effort, None);
        assert!(set_helper_agent("", Some("sonnet"), None)
            .unwrap()
            .contains("[helper]"));
    }

    #[test]
    fn a_product_can_have_a_folder_on_each_computer() {
        let new = NewProduct {
            name: "Funderly".into(),
            path: "/Users/m/code/funderly".into(),
            kind: PetKind::Bao,
            color: String::new(),
        };
        let (text, id) = add_product("", &new).unwrap();
        let text = add_path(&text, &id, "C:\\Users\\m\\code\\funderly").unwrap();
        let again = add_path(&text, &id, "C:\\Users\\m\\code\\funderly").unwrap();
        let product = &Config::parse(&again).unwrap().products[0];
        assert_eq!(product.paths.len(), 2);
        assert!(matches!(
            add_path(&text, "nope", "/x"),
            Err(EditError::Unknown(_))
        ));
    }

    #[test]
    fn mail_accounts_are_added_once_and_removed() {
        use crate::mail::{Account, Provider};
        let funderly = Account {
            address: "Hello@Funderly.app".into(),
            provider: Provider::Gmail,
            name: "Mariyam at Funderly".into(),
            login: "Mariyam@gmail.com".into(),
        };
        let text = add_mail("", &funderly).unwrap();
        let config = Config::parse(&text).unwrap();
        assert_eq!(config.mail[0].address, "hello@funderly.app");
        assert_eq!(config.mail[0].name, "Mariyam at Funderly");
        assert_eq!(config.mail[0].login, "mariyam@gmail.com");
        assert!(matches!(
            add_mail(&text, &funderly),
            Err(EditError::Duplicate(_))
        ));
        let personal = Account {
            address: "m@icloud.com".into(),
            provider: Provider::Icloud,
            name: String::new(),
            login: "m@icloud.com".into(),
        };
        let both = add_mail(&text, &personal).unwrap();
        assert_eq!(
            Config::parse(&both).unwrap().mail[1].provider,
            Provider::Icloud
        );
        assert!(!both.contains("login = \"m@icloud.com\""));
        let one = remove_mail(&both, "HELLO@funderly.app").unwrap();
        assert_eq!(Config::parse(&one).unwrap().mail.len(), 1);
        assert!(remove_mail(&one, "nobody@x.com").is_err());
    }
}
