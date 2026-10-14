// @vitest-environment node
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { CROPPED_IMAGE, invoiceImagesForVision, zoomedBands } from "./read-invoice";

const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "white" } }).jpeg().toBuffer();

describe("photos that are a crop, not the invoice", () => {
  test("a strip cut from a screen is rejected before any AI", async () => {
    const data = new Uint8Array(await image(958, 124));
    await expect(invoiceImagesForVision({ data, mime: "image/jpeg", fileName: "recorte.jpg" })).rejects.toThrow(CROPPED_IMAGE);
  });

  test("a whole photo goes through, straightened and at most 2048 px", async () => {
    const data = new Uint8Array(await image(3000, 4000));
    const [page] = (await invoiceImagesForVision({ data, mime: "image/jpeg", fileName: "factura.jpg" }))!;
    const { width, height } = await sharp(page.data).metadata();
    expect(Math.max(width!, height!)).toBe(2048);
    expect(page.mediaType).toBe("image/jpeg");
  });

  test("one good page is enough even if another is a crop", async () => {
    const data = new Uint8Array(await image(1500, 2000));
    const crop = new Uint8Array(await image(900, 150));
    await expect(invoiceImagesForVision({ data, mime: "image/jpeg", fileName: "factura.jpg", morePages: [crop] })).resolves.toHaveLength(2);
  });
});

describe("zoomed bands for small print", () => {
  const page = async (width: number, height: number) => ({ data: new Uint8Array(await image(width, height)), mediaType: "image/jpeg" as const });

  test("a portrait page is cut into overlapping bands at its own resolution", async () => {
    const bands = await zoomedBands([await page(1080, 1920)]);
    expect(bands.length).toBe(3);
    for (const band of bands) {
      const { width, height } = await sharp(band.data).metadata();
      expect(width).toBe(1080);
      expect(height).toBeLessThanOrEqual(702);
    }
  });

  test("a landscape or short page is not cut", async () => {
    expect(await zoomedBands([await page(2000, 1200)])).toEqual([]);
  });
});
