use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::de::IgnoredAny;
use serde::{Deserialize, Serialize};

use crate::checks::CheckSpec;
use crate::paths;

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("could not read {path}: {source}")]
    Read {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("invalid config: {0}")]
    Parse(#[from] toml::de::Error),
    #[error("product id `{0}` is used more than once")]
    DuplicateProduct(String),
    #[error("check id `{check}` is used more than once in product `{product}`")]
    DuplicateCheck { product: String, check: String },
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    #[serde(default)]
    pub settings: Settings,
    #[serde(default, rename = "product")]
    pub products: Vec<Product>,
    #[serde(default)]
    pub helper: Helper,
    #[serde(default, rename = "calendar")]
    pub calendars: Vec<CalendarFeed>,
    #[serde(default)]
    pub reminders: Reminders,
    // Sections from features peeps no longer has. Config files written by older versions still
    // carry them; they are read and dropped so those files keep loading.
    #[serde(default, rename = "mail")]
    _mail: IgnoredAny,
    #[serde(default, rename = "paypal")]
    _paypal: IgnoredAny,
}

/// A private iCal link, such as Google's "secret address in iCal format".
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct CalendarFeed {
    pub name: String,
    /// Usually `{secret:…}`, since the link itself grants access.
    pub url: String,
    /// Overrides the default lead time for this calendar.
    pub remind_minutes: Option<i64>,
    #[serde(default = "yes")]
    pub notify: bool,
}

fn yes() -> bool {
    true
}

/// When reminders arrive. Rules match words in a title and win over calendar and default lead times.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Reminders {
    pub default_minutes: i64,
    /// `[[reminders.rule]]` in the file, `rules` to the interface.
    #[serde(rename(deserialize = "rule"))]
    pub rules: Vec<ReminderRule>,
}

impl Default for Reminders {
    fn default() -> Self {
        Self {
            default_minutes: 15,
            rules: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReminderRule {
    /// Matches titles containing this text, ignoring case.
    pub contains: String,
    pub minutes: i64,
    /// Matching events never notify.
    #[serde(default)]
    pub mute: bool,
}

/// The assistant pet: to-dos, chat and the weekly token report.
#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Helper {
    pub name: String,
    pub pet: Pet,
    /// The agent the helper chats through. Each message goes in on stdin; Claude Code resumes the
    /// same conversation and is told about your day.
    pub chat_command: Vec<String>,
    pub chat_timeout_seconds: u64,
    /// The model the helper's agent uses, such as `sonnet` or `opus`. Unset until the user picks.
    pub model: Option<String>,
    /// How hard the agent thinks: `low`, `medium` or `high`. Unset until the user picks.
    pub effort: Option<String>,
    /// The parts of life to-dos are grouped into, as tags: `work`, `study`, `play` and any the user adds.
    pub areas: Vec<String>,
    // Settings of the old Write tab, kept readable for config files that still have them.
    #[serde(rename = "command")]
    _command: IgnoredAny,
    #[serde(rename = "timeout_seconds")]
    _timeout_seconds: IgnoredAny,
    #[serde(rename = "voices")]
    _voices: IgnoredAny,
}

impl Default for Helper {
    fn default() -> Self {
        Self {
            name: "Helper".into(),
            pet: Pet {
                kind: PetKind::Bao,
                color: "#FFD9C4".into(),
            },
            chat_command: ["claude", "-p", "--output-format", "json"]
                .map(String::from)
                .to_vec(),
            chat_timeout_seconds: 600,
            model: None,
            effort: None,
            areas: ["work", "study", "play"].map(String::from).to_vec(),
            _command: IgnoredAny,
            _timeout_seconds: IgnoredAny,
            _voices: IgnoredAny,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Settings {
    /// Answer permission requests from peeps. Turn off when another app already handles them.
    pub approvals: bool,
    pub context_window_tokens: u64,
    pub sweat_after_minutes: i64,
    pub steam_at_context: f32,
    pub full_heat_tokens_per_minute: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            approvals: true,
            context_window_tokens: 200_000,
            sweat_after_minutes: 30,
            steam_at_context: 0.85,
            full_heat_tokens_per_minute: 60_000,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Product {
    pub id: String,
    pub name: String,
    /// Folders whose agent sessions belong to this product.
    #[serde(default)]
    pub paths: Vec<String>,
    #[serde(default)]
    pub pet: Pet,
    /// Flags the product as stalled when no agent session ran for this long.
    #[serde(default)]
    pub expect_activity_every_hours: Option<i64>,
    #[serde(default, rename = "check")]
    pub checks: Vec<CheckSpec>,
    // From the removed numbers and teammates features; ignored so older files still load.
    #[serde(default, rename = "youtube_channel")]
    _youtube_channel: IgnoredAny,
    #[serde(default, rename = "teammate")]
    _teammates: IgnoredAny,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Pet {
    pub kind: PetKind,
    pub color: String,
}

impl Default for Pet {
    fn default() -> Self {
        Self {
            kind: PetKind::Bao,
            color: "#FFF3E3".into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PetKind {
    Bao,
    Gyoza,
    Wonton,
}

impl PetKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bao => "bao",
            Self::Gyoza => "gyoza",
            Self::Wonton => "wonton",
        }
    }
}

impl Config {
    pub fn parse(text: &str) -> Result<Self, ConfigError> {
        let config: Self = toml::from_str(text)?;
        config.validate()?;
        Ok(config)
    }

    pub fn load(path: &Path) -> Result<Self, ConfigError> {
        let text = std::fs::read_to_string(path).map_err(|source| ConfigError::Read {
            path: path.to_owned(),
            source,
        })?;
        Self::parse(&text)
    }

    /// The product whose folder most specifically contains `dir`.
    pub fn product_for_dir(&self, dir: &Path) -> Option<&Product> {
        self.products
            .iter()
            .flat_map(|product| {
                product
                    .paths
                    .iter()
                    .map(|root| paths::expand_home(root))
                    .filter(|root| paths::is_within(dir, root))
                    .map(move |root| (root.components().count(), product))
            })
            .max_by_key(|(depth, _)| *depth)
            .map(|(_, product)| product)
    }

    pub fn product(&self, id: &str) -> Option<&Product> {
        self.products.iter().find(|product| product.id == id)
    }

    fn validate(&self) -> Result<(), ConfigError> {
        let mut products = HashSet::new();
        for product in &self.products {
            if !products.insert(product.id.as_str()) {
                return Err(ConfigError::DuplicateProduct(product.id.clone()));
            }
            let mut checks = HashSet::new();
            for check in &product.checks {
                if !checks.insert(check.id.as_str()) {
                    return Err(ConfigError::DuplicateCheck {
                        product: product.id.clone(),
                        check: check.id.clone(),
                    });
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r##"
        [settings]
        sweat_after_minutes = 20

        [[product]]
        id = "shop"
        name = "Shop"
        paths = ["/code/shop"]
        pet = { kind = "gyoza", color = "#FFD66B" }

        [[product.check]]
        id = "orders"
        signal = "hungry"
        kind = "script"
        command = "./orders.sh"
        message = "{count} orders waiting"

        [[product]]
        id = "shop-admin"
        name = "Shop admin"
        paths = ["/code/shop/admin"]
    "##;

    #[test]
    fn parses_products_checks_and_defaults() {
        let config = Config::parse(SAMPLE).unwrap();
        assert_eq!(config.settings.sweat_after_minutes, 20);
        assert_eq!(config.settings.context_window_tokens, 200_000);
        assert_eq!(config.products.len(), 2);
        assert_eq!(config.products[0].pet.kind, PetKind::Gyoza);
        assert_eq!(config.products[0].checks[0].id, "orders");
        assert_eq!(config.products[1].pet.kind, PetKind::Bao);
    }

    #[test]
    fn matches_the_most_specific_folder() {
        let config = Config::parse(SAMPLE).unwrap();
        let id = |dir: &str| {
            config
                .product_for_dir(Path::new(dir))
                .map(|p| p.id.as_str())
        };
        assert_eq!(id("/code/shop/src"), Some("shop"));
        assert_eq!(id("/code/shop/admin/ui"), Some("shop-admin"));
        assert_eq!(id("/code/other"), None);
    }

    #[test]
    fn rejects_duplicate_products() {
        let text = r#"
            [[product]]
            id = "a"
            name = "A"
            [[product]]
            id = "a"
            name = "Again"
        "#;
        assert!(matches!(
            Config::parse(text),
            Err(ConfigError::DuplicateProduct(id)) if id == "a"
        ));
    }

    #[test]
    fn helper_has_useful_defaults_and_can_be_overridden() {
        let config = Config::parse("").unwrap();
        assert_eq!(config.helper.chat_command[0], "claude");
        assert_eq!(config.helper.name, "Helper");

        let custom = Config::parse(
            r#"
            [helper]
            chat_command = ["codex", "exec"]
            model = "sonnet"
            "#,
        )
        .unwrap();
        assert_eq!(custom.helper.chat_command, ["codex", "exec"]);
        assert_eq!(custom.helper.model.as_deref(), Some("sonnet"));
        assert_eq!(custom.helper.name, "Helper");
    }

    /// A file from before mail, numbers, teammates and the Write tab were taken out.
    #[test]
    fn settings_of_removed_features_are_ignored() {
        let config = Config::parse(
            r##"
            [helper]
            name = "Bao"
            command = ["claude", "-p", "{prompt}"]
            timeout_seconds = 240
            voices = { linkedin = "~/.peeps/voice/linkedin.md", x = "" }

            [paypal]
            product = "shop"
            sandbox = true

            [[mail]]
            address = "hello@shop.app"
            provider = "gmail"
            name = "Shop"

            [[mail]]
            address = "me@icloud.com"
            provider = "icloud"

            [[product]]
            id = "shop"
            name = "Shop"
            youtube_channel = "UCabcdefghijklmnopqrstuv"

            [[product.teammate]]
            id = "sana"
            name = "Sana"
            role = "sales"
            "##,
        )
        .unwrap();
        assert_eq!(config.helper.name, "Bao");
        assert_eq!(config.products[0].id, "shop");
        // Only those names are let through; a typo still points at the mistake.
        assert!(Config::parse("[helper]\nvoice = {}").is_err());
        assert!(Config::parse("[[product]]\nid = \"a\"\nname = \"A\"\nteammates = []").is_err());
    }

    #[test]
    fn rejects_unknown_keys() {
        assert!(Config::parse("[settings]\nsweat_after = 3").is_err());
    }

    #[test]
    fn example_configs_parse() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples");
        for name in ["minimal.toml", "founder.toml"] {
            Config::load(&root.join(name)).unwrap_or_else(|e| panic!("{name}: {e}"));
        }
    }

    #[test]
    fn reminders_reach_the_interface_as_rules() {
        let config = Config::parse(
            "[reminders]\ndefault_minutes = 10\n[[reminders.rule]]\ncontains = \"class\"\nminutes = 30\n",
        )
        .unwrap();
        let json = serde_json::to_value(&config.reminders).unwrap();
        assert_eq!(json["defaultMinutes"], 10);
        assert_eq!(json["rules"][0]["contains"], "class");
    }
}
