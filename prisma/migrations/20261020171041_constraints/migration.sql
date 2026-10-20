-- Reglas de integridad que Prisma no modela (Postgres estándar, se replican en la base shadow).

-- Un solo menú predeterminado por negocio.
CREATE UNIQUE INDEX "one_default_menu" ON "menus" ("business_id") WHERE "is_default";

-- Calificación válida.
ALTER TABLE "reviews" ADD CONSTRAINT "rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Montos y cantidades.
ALTER TABLE "products" ADD CONSTRAINT "products_price_nonneg" CHECK ("price_cents" >= 0);
ALTER TABLE "product_option_groups" ADD CONSTRAINT "option_group_select_range"
  CHECK ("min_select" >= 0 AND "max_select" >= "min_select");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_totals_nonneg"
  CHECK ("subtotal_cents" >= 0 AND "delivery_fee_cents" >= 0 AND "total_cents" >= 0);
ALTER TABLE "branches" ADD CONSTRAINT "branches_delivery_nonneg"
  CHECK ("delivery_fee_cents" >= 0 AND "min_order_cents" >= 0 AND "preorder_min_lead_min" >= 0 AND "preorder_max_days" >= 0);

-- Horarios.
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_weekday" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "themes" ADD CONSTRAINT "themes_splash_duration"
  CHECK ("splash_duration_ms" BETWEEN 1200 AND 3000);
