/**
 * Datos del negocio demo "Café El Portal". También es la herramienta de ventas:
 * precios creíbles, fotos libres de derechos (Unsplash) y dos sucursales.
 * Los teléfonos y cuentas son ficticios a propósito.
 */

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format`;

export const DEMO_BUSINESS = {
  slug: "cafe-el-portal",
  name: "Café El Portal",
  description: "Desayunos chapines, almuerzos ejecutivos y buen café desde 1998.",
  email: null,
  instagram: "cafeelportal.demo",
  whatsapp_greeting: "¡Hola! Quiero hacer este pedido:",
  whatsapp_farewell: "¡Gracias!",
  logo_url: null,
  cover_url: photo("1517248135467-4c7edcad34c4"),
};

export type DemoBranchKey = "zona1" | "antigua";

export const DEMO_BRANCHES = [
  {
    key: "zona1" as const,
    slug: "zona-1",
    name: "Zona 1",
    address: "6a avenida 8-50, zona 1",
    address_reference: "Frente al Portal del Comercio",
    city: "Ciudad de Guatemala",
    lat: 14.642,
    lng: -90.513,
    accepts_delivery: true,
    delivery_fee_cents: 1500,
    delivery_radius_km: 5,
    min_order_cents: 5000,
    preorder_mode: "next_open" as const,
    // lunes a sábado 07:00–21:00, domingo 08:00–15:00
    hours: [[0, "08:00", "15:00"], ...[1, 2, 3, 4, 5, 6].map((d) => [d, "07:00", "21:00"])] as [
      number,
      string,
      string,
    ][],
    sort: 0,
  },
  {
    key: "antigua" as const,
    slug: "antigua",
    name: "Antigua",
    address: "5a avenida norte 12",
    address_reference: "A media cuadra del Arco de Santa Catalina",
    city: "Antigua Guatemala",
    lat: 14.5586,
    lng: -90.7295,
    accepts_delivery: true,
    delivery_fee_cents: 2000,
    delivery_radius_km: 3,
    min_order_cents: 0,
    preorder_mode: "off" as const,
    // todos los días 07:00–22:00
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => [d, "07:00", "22:00"]) as [number, string, string][],
    sort: 1,
  },
];

export const DEMO_CATEGORIES = [
  "Desayunos",
  "Platos fuertes",
  "Bebidas calientes",
  "Bebidas frías",
  "Postres",
] as const;

type Category = (typeof DEMO_CATEGORIES)[number];

export type DemoOptionGroup = {
  name: string;
  min: number;
  max: number;
  options: [name: string, deltaCents: number][];
};

export type DemoProduct = {
  key: string;
  name: string;
  description: string;
  category: Category;
  price: number; // centavos
  compareAt?: number;
  image: string;
  tags?: string[];
  prep?: number;
  groups?: DemoOptionGroup[];
};

const TAMANO_CAFE: DemoOptionGroup = {
  name: "Tamaño",
  min: 1,
  max: 1,
  options: [
    ["Mediano", 0],
    ["Grande", 400],
  ],
};

export const DEMO_PRODUCTS: DemoProduct[] = [
  // ── Desayunos
  {
    key: "chapin",
    name: "Desayuno chapín",
    description: "Huevos al gusto, frijoles, plátanos fritos, queso fresco, crema y tortillas.",
    category: "Desayunos",
    price: 4500,
    image: photo("1533089860892-a7c6f0a88666"),
    tags: ["popular"],
    prep: 15,
    groups: [
      {
        name: "Huevos",
        min: 1,
        max: 1,
        options: [
          ["Estrellados", 0],
          ["Revueltos", 0],
          ["Rancheros", 0],
        ],
      },
      {
        name: "Frijoles",
        min: 1,
        max: 1,
        options: [
          ["Volteados", 0],
          ["Parados", 0],
        ],
      },
      {
        name: "Extras",
        min: 0,
        max: 3,
        options: [
          ["Extra plátanos", 800],
          ["Aguacate", 600],
          ["Queso extra", 500],
        ],
      },
    ],
  },
  {
    key: "rancheros",
    name: "Huevos rancheros",
    description: "Huevos estrellados sobre tortilla con salsa de tomate asado y frijoles.",
    category: "Desayunos",
    price: 3800,
    image: photo("1528207776546-365bb710ee93"),
    tags: ["picante"],
    prep: 12,
  },
  {
    key: "panqueques",
    name: "Panqueques con frutos rojos",
    description: "Tres panqueques esponjosos con fresas, moras, miel y mantequilla.",
    category: "Desayunos",
    price: 3500,
    image: photo("1541519227354-08fa5d50c44d"),
    tags: ["vegetariano"],
    prep: 12,
  },
  {
    key: "pan-frances",
    name: "Pan francés con miel",
    description: "Pan brioche dorado, banano, frutos rojos y miel de abeja.",
    category: "Desayunos",
    price: 3600,
    image: photo("1484723091739-30a097e8f929"),
    tags: ["vegetariano"],
    prep: 12,
  },
  {
    key: "tostada-aguacate",
    name: "Tostada de aguacate",
    description: "Pan de masa madre, aguacate, huevo pochado y semillas.",
    category: "Desayunos",
    price: 3200,
    image: photo("1559847844-5315695dadae"),
    tags: ["vegetariano", "nuevo"],
    prep: 10,
  },
  {
    key: "parfait",
    name: "Parfait de yogur y granola",
    description: "Yogur griego, granola de la casa, fresas y miel.",
    category: "Desayunos",
    price: 2800,
    image: photo("1488477181946-6428a0291777"),
    tags: ["vegetariano"],
    prep: 5,
  },
  // ── Platos fuertes
  {
    key: "ejecutivo",
    name: "Almuerzo ejecutivo del día",
    description: "Sopa, plato fuerte del día, arroz, ensalada, tortillas y refresco natural.",
    category: "Platos fuertes",
    price: 5500,
    image: photo("1504674900247-0877df9cc836"),
    tags: ["popular"],
    prep: 10,
  },
  {
    key: "hamburguesa",
    name: "Hamburguesa clásica",
    description: "Carne de res 1/3 lb, queso cheddar, lechuga, tomate y papas fritas.",
    category: "Platos fuertes",
    price: 5800,
    image: photo("1568901346375-23c9450c58cd"),
    prep: 18,
    groups: [
      {
        name: "Término",
        min: 1,
        max: 1,
        options: [
          ["Término medio", 0],
          ["Tres cuartos", 0],
          ["Bien cocido", 0],
        ],
      },
      {
        name: "Extras",
        min: 0,
        max: 3,
        options: [
          ["Tocino", 1000],
          ["Aguacate", 600],
          ["Queso extra", 500],
        ],
      },
    ],
  },
  {
    key: "hamburguesa-doble",
    name: "Hamburguesa doble",
    description: "Dos carnes, doble queso, cebolla caramelizada y papas fritas.",
    category: "Platos fuertes",
    price: 7200,
    image: photo("1550547660-d9450f859349"),
    prep: 20,
  },
  {
    key: "penne",
    name: "Penne arrabbiata",
    description: "Pasta penne en salsa de tomate picante con albahaca y parmesano.",
    category: "Platos fuertes",
    price: 5200,
    image: photo("1621996346565-e3dbc646d9a9"),
    tags: ["picante", "vegetariano"],
    prep: 15,
  },
  {
    key: "pasta-mariscos",
    name: "Pasta con mariscos",
    description: "Linguine con camarón, calamar y mejillones en salsa de tomate.",
    category: "Platos fuertes",
    price: 7800,
    image: photo("1563379926898-05f4575a45d8"),
    prep: 20,
  },
  {
    key: "pizza-margarita",
    name: "Pizza margarita",
    description: "Salsa de tomate, mozzarella fresca y albahaca.",
    category: "Platos fuertes",
    price: 6000,
    image: photo("1574071318508-1cdbab80d002"),
    tags: ["vegetariano"],
    prep: 20,
    groups: [
      {
        name: "Tamaño",
        min: 1,
        max: 1,
        options: [
          ["Personal", 0],
          ["Mediana", 3000],
        ],
      },
    ],
  },
  {
    key: "pizza-pepperoni",
    name: "Pizza de pepperoni",
    description: "Mozzarella, pepperoni y orégano. Para compartir.",
    category: "Platos fuertes",
    price: 6800,
    image: photo("1513104890138-7c749659a591"),
    tags: ["popular"],
    prep: 20,
  },
  {
    key: "lomito",
    name: "Lomito con papas",
    description: "Lomito a la parrilla 8 oz con chirmol, papas fritas y ensalada.",
    category: "Platos fuertes",
    price: 9500,
    compareAt: 10500,
    image: photo("1600891964092-4316c288032e"),
    prep: 25,
  },
  {
    key: "parrillada",
    name: "Parrillada para compartir",
    description: "Lomito, pollo, chorizo, longaniza, cebollines, guacamole y tortillas. Para 2–3.",
    category: "Platos fuertes",
    price: 16500,
    image: photo("1555939594-58d7cb561ad1"),
    tags: ["nuevo"],
    prep: 30,
  },
  {
    key: "ensalada",
    name: "Ensalada de la casa",
    description: "Mezcla de hojas, tomate, pepino, aguacate, nueces y vinagreta de miel.",
    category: "Platos fuertes",
    price: 4000,
    image: photo("1512621776951-a57141f2eefd"),
    tags: ["vegetariano"],
    prep: 10,
  },
  {
    key: "bowl",
    name: "Bowl de quinoa y aguacate",
    description: "Quinoa, garbanzos, aguacate, vegetales asados y aderezo de tahini.",
    category: "Platos fuertes",
    price: 4800,
    image: photo("1546069901-ba9599a7e63c"),
    tags: ["vegetariano"],
    prep: 10,
  },
  {
    key: "sopa-tomate",
    name: "Sopa de tomate",
    description: "Crema de tomate asado con pan tostado y queso.",
    category: "Platos fuertes",
    price: 3000,
    image: photo("1547592166-23ac45744acd"),
    tags: ["vegetariano"],
    prep: 8,
  },
  {
    key: "albondigas",
    name: "Albóndigas en salsa",
    description: "Albóndigas de res en salsa de tomate con arroz y tortillas.",
    category: "Platos fuertes",
    price: 5000,
    image: photo("1529042410759-befb1204b468"),
    prep: 15,
  },
  {
    key: "empanadas",
    name: "Empanadas (3 u.)",
    description: "Empanadas de carne y papa con chirmol de la casa.",
    category: "Platos fuertes",
    price: 3000,
    image: photo("1601050690597-df0568f70950"),
    prep: 12,
  },
  // ── Bebidas
  {
    key: "americano",
    name: "Americano",
    description: "Café de Antigua, tueste medio.",
    category: "Bebidas calientes",
    price: 1800,
    image: photo("1514432324607-a09d9b4aefdd"),
    prep: 3,
    groups: [TAMANO_CAFE],
  },
  {
    key: "capuchino",
    name: "Capuchino",
    description: "Espresso doble con leche texturizada.",
    category: "Bebidas calientes",
    price: 2400,
    image: photo("1509042239860-f550ce710b93"),
    prep: 4,
    groups: [
      TAMANO_CAFE,
      {
        name: "Leche",
        min: 1,
        max: 1,
        options: [
          ["Entera", 0],
          ["Deslactosada", 0],
          ["Almendra", 500],
        ],
      },
    ],
  },
  {
    key: "cafe-frio",
    name: "Café frío",
    description: "Cold brew de 18 horas con hielo y un toque de vainilla.",
    category: "Bebidas frías",
    price: 2600,
    image: photo("1461023058943-07fcbe16d735"),
    prep: 3,
  },
  {
    key: "limonada-fresa",
    name: "Limonada de fresa",
    description: "Limonada natural licuada con fresas.",
    category: "Bebidas frías",
    price: 2000,
    image: photo("1497534446932-c925b458314e"),
    prep: 4,
  },
  // ── Postres
  {
    key: "pastel-fresas",
    name: "Pastel de fresas y crema",
    description: "Bizcocho de vainilla, crema chantilly y fresas frescas.",
    category: "Postres",
    price: 3200,
    image: photo("1565958011703-44f9829ba187"),
    prep: 3,
  },
];

/** Agotado solo en Antigua (la disponibilidad por sucursal no afecta Zona 1). */
export const SOLD_OUT_IN_ANTIGUA = "pasta-mariscos";

/** Precio distinto solo en Antigua (centavos). */
export const ANTIGUA_PRICE_OVERRIDES: Record<string, number> = { chapin: 4800 };

export const DEMO_TIME_SLOTS = [
  { key: "breakfast" as const, name: "Desayunos", start: "06:30", end: "11:00" },
  { key: "lunch" as const, name: "Almuerzo", start: "11:30", end: "15:30" },
  { key: "dinner" as const, name: "Cena", start: "17:30", end: "21:30" },
];

export type DemoMenu = {
  key: "desayunos" | "almuerzo" | "carta";
  name: string;
  description: string;
  isDefault: boolean;
  sections: { name: string; items: string[] }[];
  /** Precio especial dentro de este menú (centavos). */
  priceOverrides?: Record<string, number>;
};

export const DEMO_MENUS: DemoMenu[] = [
  {
    key: "desayunos",
    name: "Desayunos",
    description: "De 6:30 a 11:00",
    isDefault: false,
    sections: [
      { name: "Típicos", items: ["chapin", "rancheros"] },
      { name: "Dulces", items: ["panqueques", "pan-frances", "parfait"] },
      { name: "Ligeros", items: ["tostada-aguacate"] },
      { name: "Bebidas", items: ["americano", "capuchino", "cafe-frio", "limonada-fresa"] },
    ],
  },
  {
    key: "almuerzo",
    name: "Almuerzo ejecutivo",
    description: "Lunes a viernes de 11:30 a 15:30",
    isDefault: false,
    priceOverrides: { ejecutivo: 4900 },
    sections: [
      { name: "Plato del día", items: ["ejecutivo"] },
      {
        name: "Fuertes",
        items: ["hamburguesa", "penne", "ensalada", "bowl", "sopa-tomate", "albondigas"],
      },
      { name: "Bebidas", items: ["limonada-fresa", "cafe-frio"] },
    ],
  },
  {
    key: "carta",
    name: "Cena y carta",
    description: "Nuestra carta completa",
    isDefault: true,
    sections: [
      { name: "Para compartir", items: ["parrillada", "empanadas"] },
      {
        name: "Fuertes",
        items: [
          "hamburguesa-doble",
          "pasta-mariscos",
          "pizza-margarita",
          "pizza-pepperoni",
          "lomito",
        ],
      },
      { name: "Postres", items: ["pastel-fresas"] },
      { name: "Bebidas", items: ["americano", "capuchino", "limonada-fresa"] },
    ],
  },
];

export const DEMO_CUSTOMERS = [
  "María López",
  "José Hernández",
  "Ana García",
  "Luis Pérez",
  "Carmen Morales",
  "Diego Ramírez",
  "Sofía Castillo",
  "Andrés Méndez",
  "Lucía Rodríguez",
  "Pablo Juárez",
];

/** Direcciones ficticias cerca de cada sucursal para los pedidos a domicilio. */
export const DEMO_DELIVERY_SPOTS: Record<
  DemoBranchKey,
  { address: string; reference: string; lat: number; lng: number }[]
> = {
  zona1: [
    { address: "9a calle 5-20, zona 1", reference: "Portón café", lat: 14.6385, lng: -90.5141 },
    {
      address: "12 avenida 3-15, zona 1",
      reference: "Casa esquinera",
      lat: 14.6449,
      lng: -90.5086,
    },
    {
      address: "4a avenida 15-40, zona 1",
      reference: "Frente a la farmacia",
      lat: 14.6331,
      lng: -90.5158,
    },
  ],
  antigua: [
    { address: "1a calle poniente 20", reference: "Puerta verde", lat: 14.5609, lng: -90.7352 },
    { address: "6a avenida sur 8", reference: "Junto a la tienda", lat: 14.5551, lng: -90.7318 },
  ],
};
