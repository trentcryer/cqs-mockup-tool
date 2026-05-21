import os
import tempfile
from pathlib import Path

import httpx
import streamlit as st
from dotenv import load_dotenv

from cqs_mockup.client import PrintfulClient, PrintfulError
from cqs_mockup.main import get_print_position

load_dotenv()

st.set_page_config(
    page_title="CQS Mockup Generator",
    page_icon="🎨",
    layout="centered",
)

st.markdown("""
<style>
    [data-testid="stAppViewContainer"] { background: #f8f8f6; }
    [data-testid="stMain"] { padding-top: 2rem; }
    section[data-testid="stSidebar"] { display: none; }
    h1 { font-size: 1.8rem !important; font-weight: 700; letter-spacing: -0.5px; }
    .subtitle { color: #888; font-size: 0.95rem; margin-top: -0.75rem; margin-bottom: 1.5rem; }
    .mockup-header { font-size: 1rem; font-weight: 600; color: #333; margin-top: 2rem; margin-bottom: 0.5rem; }
    .stButton > button { width: 100%; border-radius: 8px; height: 3rem; font-weight: 600; font-size: 1rem; }
    div[data-testid="stFileUploader"] { border-radius: 10px; }
</style>
""", unsafe_allow_html=True)

api_key = os.getenv("PRINTFUL_API_KEY")
if not api_key:
    st.error("PRINTFUL_API_KEY not set in .env")
    st.stop()


@st.cache_data(show_spinner=False)
def fetch_products():
    with PrintfulClient(api_key) as c:
        return c.get_products()


@st.cache_data(show_spinner=False)
def fetch_product_detail(product_id: int):
    with PrintfulClient(api_key) as c:
        return c.get_product(product_id)


@st.cache_data(show_spinner=False)
def fetch_printfiles(product_id: int):
    with PrintfulClient(api_key) as c:
        return c.get_printfiles(product_id)


# --- Header ---
st.title("CQS Mockup Generator")
st.markdown('<p class="subtitle">Upload artwork · Pick a product · Download mockups</p>', unsafe_allow_html=True)

# --- Artwork upload ---
artwork = st.file_uploader("Artwork file", type=["png"], label_visibility="collapsed",
                            help="PNG with transparency recommended")
if not artwork:
    st.markdown("##### Upload a PNG to get started")

st.divider()

# --- Product catalog ---
with st.spinner("Loading catalog..."):
    products = fetch_products()

product_map = {p["title"]: p for p in products}
product_names = sorted(product_map)

selected_name = st.selectbox("Product", product_names, label_visibility="visible")
selected_product = product_map[selected_name]
product_id: int = selected_product["id"]

# --- Color & placement (side by side, loaded from selected product) ---
detail = fetch_product_detail(product_id)
color_map: dict[str, list[int]] = {}
for v in detail["variants"]:
    color = v.get("color") or "N/A"
    color_map.setdefault(color, []).append(v["id"])

printfiles_data = fetch_printfiles(product_id)
available_placements: dict[str, str] = printfiles_data.get("available_placements", {})
placement_keys = list(available_placements.keys())

col1, col2 = st.columns(2)
with col1:
    selected_color = st.selectbox("Color", sorted(color_map.keys()))
with col2:
    selected_placement = st.selectbox(
        "Placement",
        placement_keys,
        format_func=lambda k: available_placements.get(k, k),
    )

variant_ids = color_map[selected_color]

st.markdown("")

# --- Generate ---
ready = artwork is not None
if st.button("Generate Mockup", type="primary", disabled=not ready):
    st.session_state.pop("mockups", None)
    st.session_state.pop("mockup_product", None)

    with st.spinner("Uploading artwork and rendering mockups — this takes ~15 seconds…"):
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(artwork.read())
                tmp_path = Path(tmp.name)

            position = get_print_position(printfiles_data, selected_placement, variant_ids)

            with PrintfulClient(api_key) as client:
                file_result = client.upload_file(tmp_path)
                task_key = client.create_mockup_task(
                    product_id=product_id,
                    variant_ids=variant_ids,
                    placement=selected_placement,
                    image_url=file_result["url"],
                    position=position,
                )
                result = client.poll_task(task_key)

            st.session_state["mockups"] = result.get("mockups", [])
            st.session_state["mockup_product"] = selected_name

        except PrintfulError as e:
            st.error(f"Printful error ({e.status_code}): {e}")
        except TimeoutError as e:
            st.error(f"Timed out waiting for mockups: {e}")
        finally:
            Path(tmp.name).unlink(missing_ok=True)

# --- Results ---
if "mockups" in st.session_state:
    mockups: list[dict] = st.session_state["mockups"]
    product_title: str = st.session_state["mockup_product"]

    st.divider()
    st.markdown(f'<p class="mockup-header">✓ {len(mockups)} mockup{"s" if len(mockups) != 1 else ""} · {product_title}</p>', unsafe_allow_html=True)

    for mockup in mockups:
        st.image(mockup["mockup_url"], use_container_width=True)

        img_bytes = httpx.get(mockup["mockup_url"]).content
        st.download_button(
            "Download",
            data=img_bytes,
            file_name=f"{product_title.replace(' ', '_')}_{selected_placement}.jpg",
            mime="image/jpeg",
            use_container_width=True,
        )

        for extra in mockup.get("extra", []):
            st.markdown(f"**{extra['title']}**")
            st.image(extra["url"], use_container_width=True)
            extra_bytes = httpx.get(extra["url"]).content
            st.download_button(
                f"Download — {extra['title']}",
                data=extra_bytes,
                file_name=f"{product_title.replace(' ', '_')}_{extra['title'].replace(' ', '_')}.jpg",
                mime="image/jpeg",
                use_container_width=True,
                key=f"dl_{extra['generator_mockup_id']}",
            )
