// Brand consolidation mapping - merges variants into base brands
const BRAND_MAPPING = {
  // Pase variants merge into base brands
  "Almuerzos de la casa Pase": "Almuerzos de la Casa",
  "Burrito Cantina Pase": "Burrito Cantina",
  "Burritos & Co Pase": "Burritos & Co",
  "Cinnabon Pase": "Cinnabon",
  "La Cuadra Pase": "La Cuadra",
  "Señor Burrito Pase": "Señor Burrito",
  "cinnabon pase turbo": "Cinnabon Turbo",
};

function normalizeBrandName(brandName) {
  return BRAND_MAPPING[brandName] || brandName;
}
