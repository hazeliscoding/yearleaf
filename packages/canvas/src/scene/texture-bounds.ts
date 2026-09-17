/**
 * The ceiling on how large a decoded picture is kept for drawing.
 *
 * Separate from the scene controller so it can be exercised without standing
 * up a renderer: the rule is about memory, not about PixiJS.
 */

/**
 * Longest side, in pixels, of a picture kept as a texture.
 *
 * A texture is uncompressed and lives on the GPU for as long as the desk is
 * open, so a phone photo left at full resolution costs about ninety megabytes
 * to draw a frame a few hundred world units wide. Two thousand pixels still
 * outruns any zoom tier the desk offers.
 */
export const MAX_TEXTURE_SIDE = 2048;

/**
 * Scales a decoded picture down to the texture ceiling, keeping its shape.
 *
 * Resizing from the decoded bitmap rather than re-reading the file: the
 * dimensions are known by then, so both axes can be given explicitly and the
 * picture cannot be stretched, and no second decode of the compressed bytes is
 * paid for. The oversized original is released once its replacement exists.
 *
 * A picture already within the ceiling is returned as it came, so the common
 * case costs nothing.
 */
export async function boundToTextureCeiling(source: ImageBitmap): Promise<ImageBitmap> {
  const longest = Math.max(source.width, source.height);
  if (longest <= MAX_TEXTURE_SIDE) return source;

  const scale = MAX_TEXTURE_SIDE / longest;
  const resized = await createImageBitmap(source, {
    resizeWidth: Math.max(1, Math.round(source.width * scale)),
    resizeHeight: Math.max(1, Math.round(source.height * scale)),
    resizeQuality: 'high',
  });
  source.close();
  return resized;
}
