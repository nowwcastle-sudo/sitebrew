-- 계획 3a B3: 판매 표(재고·장바구니·주문·주문 줄). 새 표는 0010 의 규칙대로 RLS 를 명시로 켠다(정책 없음 = 비소유자 기본 거부). 주문은 사용자를 지워도 남는다(user_id ON DELETE SET NULL).
CREATE TABLE "cart_items" (
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_items_user_id_product_id_pk" PRIMARY KEY("user_id","product_id"),
	CONSTRAINT "cart_items_quantity_ck" CHECK ("cart_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"order_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"unit_amount" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_items_order_id_product_id_pk" PRIMARY KEY("order_id","product_id"),
	CONSTRAINT "order_items_amount_ck" CHECK ("order_items"."unit_amount" >= 0 and "order_items"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"status" text NOT NULL,
	"subtotal" integer NOT NULL,
	"shipping" integer NOT NULL,
	"total" integer NOT NULL,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"payment_id" text,
	"address" jsonb,
	"tracking_number" text,
	"created_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "orders_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "orders_status_ck" CHECK (status in ('pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'canceled', 'refunded')),
	CONSTRAINT "orders_amounts_ck" CHECK ("orders"."subtotal" >= 0 and "orders"."shipping" >= 0 and "orders"."total" = "orders"."subtotal" + "orders"."shipping"),
	CONSTRAINT "orders_currency_ck" CHECK ("orders"."currency" = 'KRW')
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"sku" text PRIMARY KEY NOT NULL,
	"quantity" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "stock_levels_quantity_ck" CHECK ("stock_levels"."quantity" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_expires_idx" ON "orders" USING btree ("status","expires_at");
--> statement-breakpoint
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
