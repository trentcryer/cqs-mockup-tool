import os
import sys
from pathlib import Path

import httpx
import questionary
from dotenv import load_dotenv
from rich.console import Console
from rich.rule import Rule

from . import config as cfg
from .client import PrintfulClient, PrintfulError

console = Console()


def ask_artwork() -> Path:
    while True:
        raw = questionary.path("Artwork file (PNG with transparency):").ask()
        if raw is None:
            sys.exit(0)
        path = Path(raw).expanduser().resolve()
        if path.is_file() and path.suffix.lower() == ".png":
            return path
        console.print(f"[red]Not found or not a PNG:[/red] {path}")


def pick_product(client: PrintfulClient, favorite_ids: list[int]) -> dict:
    with console.status("Fetching product catalog..."):
        products = client.get_products()

    fav_set = set(favorite_ids)

    def make_choice(p: dict, star: bool = False) -> questionary.Choice:
        label = f"{'★ ' if star else '  '}{p['title']} (ID: {p['id']})"
        return questionary.Choice(label, value=p)

    favs = [make_choice(p, star=True) for p in products if p["id"] in fav_set]
    rest = [make_choice(p) for p in products if p["id"] not in fav_set]

    choices = favs + ([questionary.Separator("─── All products ───")] if favs else []) + rest

    product = questionary.select("Select a product:", choices=choices).ask()
    if product is None:
        sys.exit(0)
    return product


def pick_color(client: PrintfulClient, product_id: int) -> list[int]:
    with console.status("Fetching variants..."):
        detail = client.get_product(product_id)

    # Group variant IDs by color name
    color_map: dict[str, list[int]] = {}
    for v in detail["variants"]:
        color = v.get("color") or "N/A"
        color_map.setdefault(color, []).append(v["id"])

    color = questionary.select("Select color:", choices=sorted(color_map)).ask()
    if color is None:
        sys.exit(0)
    return color_map[color]


def pick_placement(client: PrintfulClient, product_id: int) -> tuple[str, dict]:
    with console.status("Fetching placements..."):
        printfiles = client.get_printfiles(product_id)

    placements = list(printfiles.get("available_placements", {}).keys())
    if not placements:
        console.print("[red]No placements available for this product.[/red]")
        sys.exit(1)

    placement = questionary.select("Select placement:", choices=placements).ask()
    if placement is None:
        sys.exit(0)
    return placement, printfiles


def get_print_position(printfiles: dict, placement: str, variant_ids: list[int], scale: float = 1.0) -> dict:
    pf_map = {pf["printfile_id"]: pf for pf in printfiles.get("printfiles", [])}
    for vp in printfiles.get("variant_printfiles", []):
        if vp["variant_id"] in variant_ids:
            pf_id = vp.get("placements", {}).get(placement)
            if pf_id and pf_id in pf_map:
                pf = pf_map[pf_id]
                aw, ah = pf["width"], pf["height"]
                w, h = round(aw * scale), round(ah * scale)
                return {"area_width": aw, "area_height": ah, "width": w, "height": h,
                        "top": round((ah - h) / 2), "left": round((aw - w) / 2)}
    aw, ah = 1800, 1800
    w, h = round(aw * scale), round(ah * scale)
    return {"area_width": aw, "area_height": ah, "width": w, "height": h,
            "top": round((ah - h) / 2), "left": round((aw - w) / 2)}


def download_mockups(mockups: list[dict], output_dir: Path, product_title: str, placement: str, fmt: str) -> list[Path]:
    safe = product_title.replace(" ", "_").replace("/", "-")
    saved: list[Path] = []
    for i, mockup in enumerate(mockups, start=1):
        url = mockup["mockup_url"]
        dest = output_dir / f"{safe}_{placement}_{i}.{fmt}"
        resp = httpx.get(url, follow_redirects=True)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        saved.append(dest)
    return saved


def run() -> None:
    load_dotenv()
    api_key = os.getenv("PRINTFUL_API_KEY")
    if not api_key:
        console.print("[bold red]Error:[/bold red] PRINTFUL_API_KEY not set — add it to .env")
        sys.exit(1)

    conf = cfg.load()
    output_dir = Path(conf["defaults"]["output_dir"])
    output_dir.mkdir(exist_ok=True)
    fmt = conf["defaults"]["format"]
    fav_ids: list[int] = conf["favorites"]["product_ids"]

    console.print(Rule("[bold cyan]CQS Mockup Generator[/bold cyan]"))

    artwork = ask_artwork()

    try:
        with PrintfulClient(api_key, timeout=conf["api"]["timeout"]) as client:
            product = pick_product(client, fav_ids)
            product_id: int = product["id"]

            variant_ids = pick_color(client, product_id)
            placement, printfiles = pick_placement(client, product_id)
            raw_scale = questionary.text("Logo size % of print area (10–100, default 75):").ask() or "75"
            scale = max(0.1, min(1.0, int(raw_scale) / 100))
            position = get_print_position(printfiles, placement, variant_ids, scale=scale)

            with console.status(f"Uploading [cyan]{artwork.name}[/cyan]..."):
                file_result = client.upload_file(artwork)
            console.print(f"[green]✓[/green] Artwork uploaded")

            with console.status("Queuing mockup task..."):
                task_key = client.create_mockup_task(
                    product_id=product_id,
                    variant_ids=variant_ids,
                    placement=placement,
                    image_url=file_result["url"],
                    position=position,
                    fmt=fmt,
                )
            console.print(f"[green]✓[/green] Task created: [dim]{task_key}[/dim]")

            with console.status("Waiting for Printful to render mockups..."):
                result = client.poll_task(
                    task_key,
                    interval=conf["api"]["poll_interval"],
                    max_polls=conf["api"]["max_polls"],
                )

        mockups: list[dict] = result.get("mockups", [])
        console.print(f"[green]✓[/green] {len(mockups)} mockup(s) ready — downloading...")

        saved = download_mockups(mockups, output_dir, product["title"], placement, fmt)
        for path in saved:
            console.print(f"  [dim]→[/dim] {path}")

        console.print(Rule())
        console.print(
            f"[bold green]Done![/bold green] {len(saved)} file(s) saved to [cyan]{output_dir}/[/cyan]"
        )

    except PrintfulError as e:
        console.print(f"[bold red]Printful API error ({e.status_code}):[/bold red] {e}")
        sys.exit(1)
    except TimeoutError as e:
        console.print(f"[bold red]Timeout:[/bold red] {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        console.print("\n[dim]Cancelled.[/dim]")
        sys.exit(0)


if __name__ == "__main__":
    run()
