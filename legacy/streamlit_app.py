import base64
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
    page_icon="🎵",
    layout="centered",
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');

    /* Page background */
    [data-testid="stAppViewContainer"] {
        background: #f7f3ee;
    }
    [data-testid="stMain"] {
        padding-top: 0 !important;
    }
    section[data-testid="stSidebar"] { display: none; }

    /* Header banner */
    .cqs-header {
        background: #1c1412;
        color: #f7f3ee;
        text-align: center;
        padding: 2rem 1rem 1.5rem;
        margin: -1rem -1rem 2rem;
        border-bottom: 3px solid #b8892a;
    }
    .cqs-header h1 {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 2rem !important;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #f7f3ee !important;
        margin: 0 0 0.25rem !important;
    }
    .cqs-tagline {
        color: #b8892a;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 500;
    }

    /* Body text */
    body, p, label, .stSelectbox, .stSlider {
        font-family: 'Inter', sans-serif !important;
    }

    /* Section labels — red */
    label[data-testid="stWidgetLabel"] p,
    label[data-testid="stWidgetLabel"] div p,
    [data-testid="stWidgetLabel"] p,
    .stSlider label p,
    .stSelectbox label p,
    .stFileUploader label p {
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        color: #9b1c1c !important;
        font-size: 0.85rem !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
    }

    /* "Upload a PNG to get started" prompt and all markdown text */
    [data-testid="stMarkdown"] h5,
    [data-testid="stMarkdown"] p {
        color: #9b1c1c !important;
        font-family: 'Inter', sans-serif !important;
    }

    /* Selectbox wrapper — position context for the music note */
    [data-testid="stSelectbox"] {
        position: relative;
    }

    /* The visible box */
    [data-testid="stSelectbox"] > div > div {
        border-radius: 6px !important;
        border: 2px solid #9b1c1c !important;
        background: #ffffff !important;
        padding-right: 2.5rem !important;
    }

    /* Hide the default SVG chevron Streamlit injects */
    [data-testid="stSelectbox"] svg {
        display: none !important;
    }

    /* Music note pseudo-element as the custom indicator */
    [data-testid="stSelectbox"] > div > div::after {
        content: "♪";
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1.1rem;
        color: #9b1c1c;
        pointer-events: none;
    }

    /* File uploader */
    div[data-testid="stFileUploader"] {
        border-radius: 8px;
        border: 2px dashed #b8892a !important;
        background: #fff;
    }

    /* Slider accent */
    [data-testid="stSlider"] .st-emotion-cache-1eyj6b6,
    [data-testid="stSlider"] div[role="slider"] {
        background: #b8892a !important;
    }

    /* Primary button */
    .stButton > button[kind="primary"] {
        background: #1c1412 !important;
        color: #f7f3ee !important;
        border: 2px solid #b8892a !important;
        border-radius: 6px !important;
        height: 3rem !important;
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        font-size: 0.95rem !important;
        letter-spacing: 1px !important;
        text-transform: uppercase !important;
        transition: background 0.2s, color 0.2s;
        width: 100%;
    }
    .stButton > button[kind="primary"]:hover {
        background: #b8892a !important;
        color: #1c1412 !important;
    }

    /* Download button */
    .stDownloadButton > button {
        background: transparent !important;
        color: #1c1412 !important;
        border: 1.5px solid #1c1412 !important;
        border-radius: 6px !important;
        height: 2.75rem !important;
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        font-size: 0.85rem !important;
        letter-spacing: 1px !important;
        text-transform: uppercase !important;
        width: 100%;
    }
    .stDownloadButton > button:hover {
        background: #1c1412 !important;
        color: #f7f3ee !important;
    }

    /* Divider */
    hr {
        border-color: #d4c5b0 !important;
    }

    /* Mockup result header */
    .mockup-header {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.1rem;
        font-weight: 700;
        color: #1c1412;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
    }

    /* Mockup images */
    [data-testid="stImage"] img {
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(28,20,18,0.12);
    }
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
_logo_path = Path(__file__).parent / "cqs_logo.png"
_logo_b64 = base64.b64encode(_logo_path.read_bytes()).decode() if _logo_path.exists() else ""
_logo_img = f'<img src="data:image/png;base64,{_logo_b64}" style="height:90px;margin-bottom:0.75rem;" />' if _logo_b64 else ""

st.markdown(f"""
<div class="cqs-header">
    {_logo_img}
    <h1>CQS Mockup Generator</h1>
    <p class="cqs-tagline">Custom Quartet Stuff &nbsp;·&nbsp; Upload · Configure · Download</p>
</div>
""", unsafe_allow_html=True)

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

logo_scale = st.slider("Logo size (% of print area)", min_value=10, max_value=100, value=75, step=5) / 100

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

            position = get_print_position(printfiles_data, selected_placement, variant_ids, scale=logo_scale)

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
    st.markdown(f'<p class="mockup-header">{len(mockups)} Mockup{"s" if len(mockups) != 1 else ""} &mdash; {product_title}</p>', unsafe_allow_html=True)

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
