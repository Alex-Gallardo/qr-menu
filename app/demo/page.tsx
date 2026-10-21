import { redirect } from "next/navigation";

/** /demo → el negocio demo (herramienta de ventas). */
export default function DemoPage() {
  redirect("/cafe-el-portal");
}
