# Server_CLIP_CPU_CLIP_EXE.py
import asyncio
import os
import base64
import uuid
import sys
import json
from aiohttp import web
from PIL import Image
import torch
import clip

# --- CONFIG ---
CONFIG_FILE = "config.json"
DEFAULT_CONFIG = {
    "PORT": 9095,
    "WORKERS": 2,
    "UPLOAD_DIR": "uploaded",
    "TEXT_LABELS": ["cat", "car"],
    "REQUEST_LABELS_PRIORITY": False
}

# --- LOAD CONFIG ---
def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
    return DEFAULT_CONFIG

config = load_config()

# --- DIRECTORIES ---
if getattr(sys, "frozen", False):
    # Running as EXE
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Running as script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_DIR = os.path.join(BASE_DIR, config.get("UPLOAD_DIR", "uploaded"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

def load_clip_model(model_name="ViT-B/32", device="cpu", weights_dir="clip_weights"):
    """
    PyInstaller-friendly function to load CLIP model and preprocess.

    Args:
        model_name (str): CLIP model name.
        device (str): "cpu" or "cuda".
        weights_dir (str): Folder to store weights.

    Returns:
        model: CLIP model
        preprocess: CLIP preprocess function
    """
    # Determine base folder (PyInstaller onefile support)
    if getattr(sys, "frozen", False):
        # Running as EXE
        base_dir = os.path.dirname(sys.executable)
    else:
        # Running as script
        base_dir = os.path.dirname(os.path.abspath(__file__))

    weights_path = os.path.join(base_dir, weights_dir)
    os.makedirs(weights_path, exist_ok=True)

    # Build the paths for model and preprocess
    model_weights_file = os.path.join(weights_path, model_name.replace("/", "-") + ".pt")

    print(f"[CLIP] Weights path: {weights_path} model_weights_file: {model_weights_file} os path model file exists: {os.path.exists(model_weights_file)}")
    if not os.path.exists(model_weights_file):
        print(f"[CLIP] Weights not found, downloading to: {model_weights_file}")
    else:
        print(f"[CLIP] Using existing weights from: {model_weights_file}")

    # Load the model (clip.load will download if missing)
    model, preprocess = clip.load(model_name, device=device, download_root=weights_path)
    return model, preprocess

# --- DEVICE & MODEL ---
device = "cpu"
model, preprocess = load_clip_model(device=device)

# --- STORAGE ---
image_queue = asyncio.Queue()
results = {}  # job_id -> result

# --- WORKER ---
async def worker(worker_id):
    while True:
        job_id, img_path, request_labels = await image_queue.get()
        print(f"[Worker {worker_id}] Processing {img_path}")
        try:
            img = preprocess(Image.open(img_path).convert("RGB")).unsqueeze(0).to(device)

            # Determine labels to use
            if request_labels and config.get("REQUEST_LABELS_PRIORITY", False):
                labels = request_labels
            else:
                labels = config.get("TEXT_LABELS", ["cat", "car"])

            # Encode text
            text_tokens = clip.tokenize(labels).to(device)

            # Encode image
            with torch.no_grad():
                image_features = model.encode_image(img)
                text_features = model.encode_text(text_tokens)

                image_features /= image_features.norm(dim=-1, keepdim=True)
                text_features /= text_features.norm(dim=-1, keepdim=True)

                similarity = (100.0 * image_features @ text_features.T).softmax(dim=-1)
                similarity_scores = similarity.cpu().numpy().tolist()

            results[job_id] = {
                "status": "done",
                "result": similarity_scores,
                "ID": job_id
            }

            os.remove(img_path)
            print(f"[Worker {worker_id}] Finished job {job_id}")

        except Exception as e:
            results[job_id] = {"status": "error", "error": str(e)}
        finally:
            image_queue.task_done()

# --- ROUTES ---
async def process_image(request):
    try:
        data = await request.json()
        image_bytes = base64.b64decode(data['image_data'])
        request_labels = data.get('TEXT_LABELS', None)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

    job_id = str(uuid.uuid4())
    img_path = os.path.join(UPLOAD_DIR, f"{job_id}.png")
    with open(img_path, "wb") as f:
        f.write(image_bytes)

    results[job_id] = {"status": "queued", "request_labels": request_labels}
    await image_queue.put((job_id, img_path, request_labels))
    return web.json_response({"job_id": job_id, "status": "queued"})

async def get_result(request):
    job_id = request.match_info['job_id']
    if job_id not in results:
        return web.json_response({"error": "Invalid job ID"}, status=404)
    result = results[job_id]
    return web.json_response({
        "status": result["status"],
        "result": result.get("result"),
        "ID": result["ID"]
    })

# --- STARTUP ---
async def on_startup(app):
    for i in range(config.get("WORKERS", 2)):
        asyncio.create_task(worker(i))

# --- APP ---
app = web.Application()
app.router.add_post('/process', process_image)
app.router.add_get('/result/{job_id}', get_result)
app.on_startup.append(on_startup)

# --- RUN ---
if __name__ == '__main__':
    print(f"Starting CPU CLIP server on port {config.get('PORT', 9095)}...")
    web.run_app(app, port=config.get('PORT', 9095))