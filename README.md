# ImageBlocker with AI

## INTRODUCTION

**ImageBlocker with AI** is a browser extension designed for automatic image filtering at page runtime. The extension integrates with an external AI-powered application to filter images on the web based on user-defined parameters. It can work with any image classifier model, such as **CLIP (Contrastive Language–Image Pretraining)**, to identify and remove or modify images in real-time.

---

## REQUIREMENTS

To use the extension, you'll need:

1. The browser extension itself [link here](https://addons.mozilla.org/ru/firefox/addon/imageblocker-with-ai/).
2. An AI-powered application that processes images. The extension specifically requires a classifier model like CLIP ([more details here](https://github.com/openai/CLIP)).

A simple source code for such an application is provided in the `server` folder, separated into **CPU** and **GPU** versions. Additionally, a compiled **Windows executable** for the CPU version is available in the `/releases` section for easy setup.

**Important Notes:**

* CPU and GPU versions of the server application have different requirements, listed in their respective `requirements.txt` files.
* While the GPU version offers significantly better performance, it requires a compatible installation of NVIDIA [CUDA](https://developer.nvidia.com/cuda-downloads) on the processing machine.

---

## CONFIGURATION AND PREFERENCES

The server-side application reads configuration from a `config.json` file located in the same folder as the executable. A minimal example:

```json
{
  "PORT": 9095,
  "WORKERS": 10,
  "UPLOAD_DIR": "uploaded",
  "TEXT_LABELS": ["cat", "car"],
  "REQUEST_LABELS_PRIORITY": true
}
```

**Parameters:**

* **PORT** – the port your machine uses to expose the application as a service over TCP/IP.
* **WORKERS** – number of model instances that can run in parallel. Higher numbers allow faster processing but consume more system resources.
* **UPLOAD\_DIR** – directory where incoming images are stored until processed.
* **TEXT\_LABELS** – default labels passed to the model with the image.
* **REQUEST\_LABELS\_PRIORITY** – if true, labels included in requests override default labels (recommended: true).

---

### Profiles and Filtering

On the extension side, the first place to check is the **Filtering** tab in the popup. Here you can add/remove labels for the default profile or create new profiles.

**Best practices:**

* Add a few labels marking recognizable objects you want to **filter out** (`to filter` flag).
* Add a few labels for objects you want to **keep visible** (`to keep` flag), such as *text, memes, icons, cars, or nature*.

> CLIP distributes probabilities across the active labels during processing. If no suitable label is available for an image, the chance of false positives increases significantly.

Profiles can be assigned as:

* **Default for all sites** – applies globally, except for sites with a specific default profile.
* **Default for a specific site** – overrides the global default for that site.

---

### Control Panel

The **Control Panel** tab includes:

#### Sliders:

* **Big Slider** – recommended for general image filtering.
* **Sensitive Slider** – for images with extremely low recognition scores. In such cases, you can set the Big Slider to zero and rely on the Sensitive Slider.

> Changing either slider **re-triggers the filtering function** for the current tab, allowing immediate adjustments.

#### Filtering Modes:

1. **Hide with Hover** – hides images and background containers, revealing them when hovering the mouse.
2. **Hide Opacity 0%** – makes images and background images completely invisible.
3. **Remove Elements** – removes the entire element containing the image (**not recommended** due to potential site layout issues).

#### Options:

* **Enable Image Filtering** – enable filtering for all sites (excluding blacklisted sites).
* **Premoderation** – hides images immediately when detected. Uses the same hiding method as *Hide with Hover*, even in *Remove Elements* mode.
* **Enforce for Current Site** – forces processing on the current site even if blacklisted or filtering is disabled globally.
* **Blacklist Management** – add/remove sites from the blacklist.
* **Custom Cache** – set how many images the extension caches for faster processing.
* **Server Settings** – assign a custom IP and port to connect to the server-side application.

---

## FINAL REMARKS

Thank you for exploring **ImageBlocker with AI**, a browser extension powered by neural networks. Your feedback and discussions are welcome, and I’m always open to new perspectives and collaborations.

If you’re interested in learning more or chatting about my projects, feel free to contact me via **Telegram [@ExcogitatorWarrior](https://t.me/ExcogitatorWarrior)**.
