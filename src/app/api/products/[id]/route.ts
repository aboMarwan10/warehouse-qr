import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_UNIT } from "@/lib/product-unit";
import { PRODUCT_INCLUDE } from "@/lib/variant-groups";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  // null removes the main photo (the owner removed every photo).
  imageUrl: z.string().url().nullable().optional(),
  /** Secondary photos, in order (the main one is imageUrl). */
  images: z.array(z.string().url()).max(8).optional(),
  inStock: z.boolean().optional(),
  onSale: z.boolean().optional(),
  salePrice: z.number().positive().nullable().optional(),
  saleBannerImageUrl: z.string().url().nullable().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  subcategoryId: z.string().min(1).nullable().optional(),
  unit: z.enum([PRODUCT_UNIT.UNIT, PRODUCT_UNIT.CARTON]).optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { categoryIds, ...rest } = parsed.data;
  // Setting a quantity also sets in/out of stock, unless the request says.
  if (rest.stockQuantity != null && rest.inStock === undefined) rest.inStock = rest.stockQuantity > 0;

  if (rest.onSale !== undefined || rest.salePrice !== undefined || rest.price !== undefined) {
    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const resolvedOnSale = rest.onSale ?? existing.onSale;
    const resolvedSalePrice = rest.salePrice !== undefined ? rest.salePrice : existing.salePrice;
    const resolvedPrice = rest.price ?? existing.price;
    if (resolvedOnSale && (resolvedSalePrice == null || resolvedSalePrice >= resolvedPrice)) {
      return NextResponse.json(
        { error: "salePrice must be set and lower than price when onSale is true" },
        { status: 400 }
      );
    }
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...rest,
      categories: categoryIds ? { set: categoryIds.map((id) => ({ id })) } : undefined,
    },
    include: PRODUCT_INCLUDE,
  });
  return NextResponse.json(product);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Order items reference their product, so a product that has ever been
  // ordered can't be deleted without breaking past orders; tell the admin
  // why instead of failing with a generic 500.
  const orderItemCount = await prisma.orderItem.count({ where: { productId: params.id } });
  if (orderItemCount > 0) {
    return NextResponse.json({ error: "has_orders" }, { status: 409 });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
