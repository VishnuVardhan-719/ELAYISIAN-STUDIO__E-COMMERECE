import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import {
  getCollectionBySlug,
  getCreatorById,
  getProductById,
  listAllProducts,
  listCategories,
  listCollections,
  listCreators,
  listProducts,
  listProductsByIds,
  listProductsForCreator,
  listRelatedProducts,
  saveProduct,
  updateCreator,
} from "../store";

const router = Router();

const productQuerySchema = z.strictObject({
  search: z.string().optional(),
  category: z.string().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "name"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  creatorId: z.string().min(1).optional(),
});

const productSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  creatorId: z.string().min(1),
  categoryId: z.string().min(1),
  price: z.number(),
  images: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  material: z.string().min(1),
  dimensions: z.string().min(1),
  stock: z.number(),
  status: z.enum(["active", "draft"]),
  featured: z.boolean().optional(),
});

const creatorPatchSchema = z
  .strictObject({
    name: z.string().min(1).optional(),
    studio: z.string().min(1).optional(),
    specialty: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    bio: z.string().min(1).optional(),
    image: z.string().min(1).optional(),
    cover: z.string().min(1).optional(),
    since: z.number().int().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0);

router.get("/products", async (req, res) => {
  const { creatorId, ...filters } = productQuerySchema.parse(req.query);
  res.json(await listProducts(filters, creatorId));
});

router.get(
  "/products/manage",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res) => {
    const creatorId = z.string().min(1).optional().parse(req.query.creatorId);
    if (req.user!.role === "creator") {
      if (!req.user!.creatorId || (creatorId && creatorId !== req.user!.creatorId))
        throw new HttpError(403, "You do not have access to this resource.");
      res.json(await listProductsForCreator(req.user!.creatorId));
      return;
    }
    res.json(
      creatorId
        ? await listProductsForCreator(creatorId)
        : await listAllProducts(),
    );
  },
);

router.post("/products/by-ids", async (req, res) => {
  const { ids } = z
    .strictObject({ ids: z.array(z.string().min(1)) })
    .parse(req.body);
  res.json(await listProductsByIds([...new Set(ids)]));
});

router.post(
  "/products",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res) => {
    const product = productSchema.parse(req.body);
    const existing = (await listAllProducts()).find(
      (entry) => entry.id === product.id,
    );
    if (
      req.user!.role === "creator" &&
      (!req.user!.creatorId ||
        product.creatorId !== req.user!.creatorId ||
        (existing && existing.creatorId !== req.user!.creatorId))
    )
      throw new HttpError(403, "You do not have access to this resource.");
    if (!(await listCreators()).some((creator) => creator.id === product.creatorId))
      throw new HttpError(400, "Invalid request");
    if (
      !(await listCategories()).some(
        (category) => category.id === product.categoryId,
      )
    )
      throw new HttpError(400, "Invalid request");
    try {
      res.status(existing ? 200 : 201).json(await saveProduct(product));
    } catch (error) {
      if (error instanceof Error) throw new HttpError(400, error.message);
      throw error;
    }
  },
);

router.patch(
  "/creators/:id",
  requireAuth,
  requireRole("creator", "admin"),
  async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    if (req.user!.role === "creator" && req.user!.creatorId !== id)
      throw new HttpError(403, "You do not have access to this resource.");
    const creator = await updateCreator(id, creatorPatchSchema.parse(req.body));
    if (!creator) throw new HttpError(404, "Creator not found.");
    res.json(creator);
  },
);

router.get("/products/:id/related", async (req, res) => {
  res.json(await listRelatedProducts(req.params.id));
});

router.get("/products/:id", async (req, res) => {
  res.json(await getProductById(req.params.id));
});

router.get("/categories", async (_req, res) => {
  res.json(await listCategories());
});

router.get("/creators", async (_req, res) => {
  res.json(await listCreators());
});

router.get("/creators/:id", async (req, res) => {
  res.json(await getCreatorById(req.params.id));
});

router.get("/collections", async (_req, res) => {
  res.json(await listCollections());
});

router.get("/collections/:slug", async (req, res) => {
  res.json(await getCollectionBySlug(req.params.slug));
});

export default router;