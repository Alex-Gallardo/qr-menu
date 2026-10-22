import {
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Lato,
  Lobster_Two,
  Nunito,
  Pacifico,
  Playfair_Display,
  Poppins,
  Work_Sans,
} from "next/font/google";
import type { FontName } from "./fonts";

/*
 * Fuentes del catálogo para el menú de cada negocio. preload: false → el
 * navegador solo descarga las que el menú usa de verdad (las demás quedan como
 * @font-face sin pedir). Bricolage Grotesque e Inter ya vienen del layout raíz.
 * next/font exige las opciones escritas como literales en cada llamada.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-fraunces",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-playfair",
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-dm-serif",
});
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-pacifico",
});
const lobsterTwo = Lobster_Two({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-lobster-two",
});
const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-nunito",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-poppins",
});
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--font-lato",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-dm-sans",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-work-sans",
});

/** Clase que define la variable CSS de cada fuente (vacía para las del layout raíz). */
const FONT_CLASS: Record<FontName, string> = {
  "Bricolage Grotesque": "",
  Inter: "",
  Fraunces: fraunces.variable,
  "Playfair Display": playfair.variable,
  "DM Serif Display": dmSerif.variable,
  Pacifico: pacifico.variable,
  "Lobster Two": lobsterTwo.variable,
  Nunito: nunito.variable,
  Poppins: poppins.variable,
  Lato: lato.variable,
  "DM Sans": dmSans.variable,
  "Work Sans": workSans.variable,
};

export const fontClasses = (...names: FontName[]) =>
  names
    .map((n) => FONT_CLASS[n])
    .filter(Boolean)
    .join(" ");
