import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_UNIT } from "@/lib/product-unit";
import { toPublicProduct } from "@/lib/public-product";
import { PRODUCT_INCLUDE } from "@/lib/variant-groups";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: PRODUCT_INCLUDE,
  });
  // Buyers never get the exact stock quantity; the admin does.
  const session = await getServerSession(authOptions);
  return NextResponse.json(session ? products : products.map(toPublicProduct));
}

const createProductSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z.number().positive(),
    imageUrl: z.string().url().optional(),
    images: z.array(z.string().url()).max(8).optional(),
    inStock: z.boolean().optional(),
    onSale: z.boolean().optional(),
    salePrice: z.number().positive().optional(),
    saleBannerImageUrl: z.string().url().optional(),
    categoryIds: z.array(z.string().min(1)).optional(),
    subcategoryId: z.string().min(1).optional(),
    unit: z.enum([PRODUCT_UNIT.UNIT, PRODUCT_UNIT.CARTON]).optional(),
    stockQuantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
  })
  .refine((data) => !data.onSale || (data.salePrice != null && data.salePrice < data.price), {
    message: "salePrice must be set and lower than price when onSale is true",
    path: ["salePrice"],
  });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { categoryIds, ...rest } = parsed.data;
  // A tracked product starts in or out of stock according to its quantity.
  if (rest.stockQuantity != null && rest.inStock === undefined) rest.inStock = rest.stockQuantity > 0;

  // New products go to the end of the admin's ordering.
  const last = await prisma.product.aggregate({ _max: { sortOrder: true } });

  const product = await prisma.product.create({
    data: {
      ...rest,
      sortOrder: (last._max.sortOrder ?? 0) + 10,
      categories: categoryIds ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
    },
    include: PRODUCT_INCLUDE,
  });
  return NextResponse.json(product, { status: 201 });
}
