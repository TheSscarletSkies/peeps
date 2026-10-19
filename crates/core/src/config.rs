use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Deserialize;

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
            color: "#F4E4C8".into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PetKind {
    Bao,
    Gyoza,
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
}
