//! Changes the config file in place, keeping the user's comments and layout.

use serde::Deserialize;
use toml_edit::{value, Array, ArrayOfTables, DocumentMut, InlineTable, Item, Table};

use crate::config::{Config, ConfigError, Pet, PetKind};

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
}
