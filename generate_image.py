#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai>=1.0.0",
#     "pillow>=10.0.0",
# ]
# ///
"""
Generate, edit, and analyze images using Google's Nano Banana Pro (Gemini 3.1 Flash Image) API.

Usage:
    # Generate new image from text
    uv run generate_image.py --prompt "a sunset over mountains" --filename "sunset.png"
    
    # Edit existing image
    uv run generate_image.py --prompt "make it purple" --input-image photo.jpg --filename "purple-photo.png"
    
    # Describe/analyze an image (text output only)
    uv run generate_image.py --describe --input-image photo.jpg --prompt "What's in this image?"
    
    # Multiple images for context
    uv run generate_image.py --prompt "combine these styles" --input-image style1.jpg --input-image style2.jpg --filename "combined.png"
"""

import argparse
import os
import sys
from pathlib import Path


def get_api_key(provided_key: str | None) -> str | None:
    """Get API key from argument first, then environment."""
    if provided_key:
        return provided_key
    return os.environ.get("GEMINI_API_KEY")


def main():
    parser = argparse.ArgumentParser(
        description="Generate, edit, and analyze images using Nano Banana Pro (Gemini 3.1 Flash Image)"
    )
    parser.add_argument(
        "--prompt", "-p",
        required=True,
        help="Text prompt (image description, editing instructions, or question about image)"
    )
    parser.add_argument(
        "--filename", "-f",
        help="Output filename (e.g., sunset-mountains.png). Required unless using --describe"
    )
    parser.add_argument(
        "--input-image", "-i",
        action="append",
        help="Input image path for editing or analysis (can be specified multiple times)"
    )
    parser.add_argument(
        "--describe", "-d",
        action="store_true",
        help="Describe/analyze mode: output text description only, no image generation"
    )
    parser.add_argument(
        "--resolution", "-r",
        choices=["1K", "2K", "4K"],
        default="1K",
        help="Output resolution for image generation: 1K (default), 2K, or 4K"
    )
    parser.add_argument(
        "--aspect-ratio",
        default=None,
        help="Aspect ratio for image generation (e.g., 1:1, 16:9, 9:16, 3:2, 4:3, 21:9)"
    )
    parser.add_argument(
        "--api-key", "-k",
        help="Gemini API key (overrides GEMINI_API_KEY env var)"
    )
    parser.add_argument(
        "--model", "-m",
        default="gemini-3.1-flash-image-preview",
        help="Model to use for generation (default: gemini-3.1-flash-image-preview)"
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.describe and not args.filename:
        print("Error: --filename is required unless using --describe mode", file=sys.stderr)
        sys.exit(1)

    # Get API key
    api_key = get_api_key(args.api_key)
    if not api_key:
        print("Error: No API key provided.", file=sys.stderr)
        print("Please either:", file=sys.stderr)
        print("  1. Provide --api-key argument", file=sys.stderr)
        print("  2. Set GEMINI_API_KEY environment variable", file=sys.stderr)
        sys.exit(1)

    # Import here after checking API key to avoid slow import on error
    from google import genai
    from google.genai import types
    from PIL import Image as PILImage

    # Initialise client
    client = genai.Client(api_key=api_key)

    # Set up output path if generating
    output_path = None
    if args.filename:
        output_path = Path(args.filename)
        output_path.parent.mkdir(parents=True, exist_ok=True)

    # Load input images if provided
    input_images = []
    output_resolution = args.resolution
    
    print(f"[NanoBanana] Prompt: {args.prompt[:80]}{'...' if len(args.prompt) > 80 else ''}")
    if args.aspect_ratio:
        print(f"[NanoBanana] Aspect ratio: {args.aspect_ratio}")
    
    if args.input_image:
        print(f"[NanoBanana] Loading {len(args.input_image)} input image(s)...")
        for i, img_path in enumerate(args.input_image):
            try:
                img = PILImage.open(img_path)
                input_images.append(img)
                print(f"[NanoBanana]   Image {i+1}: {img_path} ({img.size[0]}x{img.size[1]}, {img.mode})")
                
                # Auto-detect resolution from first image if not explicitly set by user
                if not args.describe and args.resolution == "1K" and len(input_images) == 1:
                    width, height = img.size
                    max_dim = max(width, height)
                    if max_dim >= 3000:
                        output_resolution = "4K"
                    elif max_dim >= 1500:
                        output_resolution = "2K"
                    else:
                        output_resolution = "1K"
                    print(f"[NanoBanana] Auto-detected resolution: {output_resolution} (from input {width}x{height})")
            except Exception as e:
                print(f"[NanoBanana] Error loading input image {img_path}: {e}", file=sys.stderr)
                sys.exit(1)
        print(f"[NanoBanana] Successfully loaded {len(input_images)} image(s)")
    else:
        if args.describe:
            print("Error: --describe requires at least one --input-image", file=sys.stderr)
            sys.exit(1)
        print("[NanoBanana] No input images - generating from text only")

    # Build contents (images first, then prompt)
    if input_images:
        contents = input_images + [args.prompt]
    else:
        contents = args.prompt

    # Configure request based on mode
    if args.describe:
        # Description mode: text output only
        print(f"Analyzing {len(input_images)} image(s)...")
        try:
            response = client.models.generate_content(
                model=args.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT"]
                )
            )
            
            # Output text response
            print("\n" + "="*50)
            print("DESCRIPTION/ANALYSIS")
            print("="*50)
            for part in response.parts:
                if part.text is not None:
                    print(part.text)
            print("="*50)
            
        except Exception as e:
            print(f"Error analyzing image: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Generation/editing mode: image output
        if input_images:
            print(f"Editing with {len(input_images)} image(s) at resolution {output_resolution}...")
        else:
            print(f"Generating image with resolution {output_resolution}...")

        try:
            response = client.models.generate_content(
                model=args.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    image_config=types.ImageConfig(
                        image_size=output_resolution,
                        **({"aspect_ratio": args.aspect_ratio} if args.aspect_ratio else {})
                    )
                )
            )

            # Process response and convert to PNG
            image_saved = False
            text_response = []
            
            for part in response.parts:
                if part.text is not None:
                    text_response.append(part.text)
                elif part.inline_data is not None:
                    # Convert inline data to PIL Image and save as PNG
                    from io import BytesIO

                    # inline_data.data is already bytes, not base64
                    image_data = part.inline_data.data
                    if isinstance(image_data, str):
                        # If it's a string, it might be base64
                        import base64
                        image_data = base64.b64decode(image_data)

                    image = PILImage.open(BytesIO(image_data))

                    # Ensure RGB mode for PNG (convert RGBA to RGB with white background if needed)
                    if image.mode == 'RGBA':
                        rgb_image = PILImage.new('RGB', image.size, (255, 255, 255))
                        rgb_image.paste(image, mask=image.split()[3])
                        rgb_image.save(str(output_path), 'PNG')
                    elif image.mode == 'RGB':
                        image.save(str(output_path), 'PNG')
                    else:
                        image.convert('RGB').save(str(output_path), 'PNG')
                    image_saved = True

            # Print any text response (model sometimes comments on the generation)
            if text_response:
                print(f"\nModel notes: {' '.join(text_response)}")

            if image_saved:
                full_path = output_path.resolve()
                print(f"\nImage saved: {full_path}")
            else:
                print("Error: No image was generated in the response.", file=sys.stderr)
                sys.exit(1)

        except Exception as e:
            print(f"Error generating image: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
