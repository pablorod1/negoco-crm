// @vitest-environment node
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { CROPPED_IMAGE, invoiceImagesForVision } from "./read-invoice";

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
