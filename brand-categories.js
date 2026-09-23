// Brand categorization for Colombian market
const BRAND_CATEGORIES = {
  "Core brands": [
    "Brunch & Munch",
    "La Cuadra",
    "Avocalia",
    "Mr Beast Burger",
    "Burritos & Co",
    "Cinnabon",
    "Desayunos de la Abuela",
    "Green House",
    "LA ÑAMGUCHERIA"
  ],
  "New Brands": [
    "The Breakfast Club",
    "La Casa Mexicana",
    "House of Salads",
    "The Egg Spot",
    "Honest Food",
    "MonteVerde",
    "El Ejecutivo",
    "Local - Cocina Consciente",
    "Foodhub",
    "House of Burgers",
    "Numa Cocina Mediterranea",
    "El Calentao",
    "Doritos Locos By Doritos",
    "Casa Arabe",
    "Desgranados & Co",
    "Pasta Lab",
    "Pasta Nova",
    "Urban Smash",
    "Desayunos Colombianos",
    "Desgranados",
    "Otras Marcas",
    "Puntos Fsicos",
    "DoubleDown",
    "Mundial",
    "Marca Italiana",
    "Local 109",
    "Plaza Claro"
  ],
  "Other brands": [
    "Get Smashed",
    "Almuerzos de la Casa",
    "LA PANQUEQUERIA",
    "Alba Vegetarian",
    "SÁNDUCHES EL JEFE",
    "Brunch Club",
    "Foodology",
    "Señor Burrito",
    "Cacerola",
    "Pret Sandwich Bistro",
    "Desayunos de mi Tierrita",
    "Que Chicken",
    "Bottaniko",
    "La Folie",
    "Frost By Oreo",
    "Vicio",
    "Dembow",
    "La Cuadra Desayunos",
    "Mañanero Diario",
    "Burrito Cantina",
    "Selvatiko",
    "San Jeronimo",
    "ACPM Corrientazo",
    "Avocalia Desayunos",
    "Burguer Lane",
    "IHOP",
    "Sandwich Café",
    "The Crunch"
  ],
  "Turbo Core": [
    "Burritos & Co TURBO",
    "La Cuadra Turbo",
    "AVOCALIA TURBO",
    "BRUNCH & MUNCH TURBO",
    "Green House Turbo",
    "Mr Beast Burger Turbo",
    "Cinnabon Turbo",
    "Ñamgucheria Turbo",
    "Desayunos de la Abuela Turbo"
  ],
  "Turbo New": [
    "The Egg Spot Turbo",
    "House of Burgers Turbo",
    "Monteverde Turbo",
    "The Breakfast Club Turbo",
    "El Ejecutivo Turbo",
    "Honest Food Turbo",
    "Numa Cocina Mediterranea - Turbo",
    "Desayunos Colombianos Turbo",
    "House of Salads Turbo",
    "La Casa Mexicana Turbo",
    "Local Cocina Consciente turbo",
    "Desgranados & Co Turbo",
    "Doritos Locos By Dorito Turbo",
    "Casa Árabe Turbo"
  ],
  "Turbo Other": [
    "El Jefe Turbo",
    "SAN JERÓNIMO TURBO",
    "Frost By Oreo Turbo",
    "Vicio Turbo",
    "Mañanero Diario Turbo",
    "Alba Vegetarian Turbo",
    "Cacerola Turbo",
    "Dembow by Maluma Turbo",
    "Bottaniko Turbo",
    "Que Chicken Turbo",
    "Faltantes Turbo",
    "Desayunos mi Tierrita Turbo",
    "Señor Burrito Turbo",
    "Selvatiko Turbo",
    "Foodology Court Turbo",
    "La Cuadra Desayunos Turbo",
    "Pret Sandwich Bistro Turbo",
    "Burrito Cantina Turbo",
    "Almuerzos de la Casa Turbo",
    "Acpm Corrientazo Turbo",
    "Ihop Turbo",
    "La Folie Turbo"
  ]
};

// Get category for a brand
function getBrandCategory(brandName) {
  for (const [category, brands] of Object.entries(BRAND_CATEGORIES)) {
    if (brands.some(b => b.toLowerCase() === brandName.toLowerCase())) {
      return category;
    }
  }
  return null; // Brand not found
}

// Get all categorized brands
function getAllCategorizedBrands() {
  const all = [];
  for (const brands of Object.values(BRAND_CATEGORIES)) {
    all.push(...brands);
  }
  return all;
}
