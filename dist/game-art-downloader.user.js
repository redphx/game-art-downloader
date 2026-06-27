// ==UserScript==
// @name         Game Art Downloader
// @namespace    https://github.com/redphx
// @version      1.0.1-dev
// @author
// @description  Download game arts from Steam, GOG, XBOX, Playstation and Nintendo web stores
// @license      MIT
// @downloadURL  https://github.com/redphx/game-art-downloader/releases/latest/download/game-art-downloader.user.js
// @updateURL    https://github.com/redphx/game-art-downloader/raw/refs/heads/main/dist/game-art-downloader.meta.js
// @match        https://www.xbox.com/*/games/store/*
// @match        https://store.playstation.com/*/product/*
// @match        https://store.playstation.com/*/concept/*
// @match        https://www.nintendo.com/*/store/products/*
// @match        https://www.gog.com/*/game/*
// @match        https://store.steampowered.com/app/*
// @grant        none
// @run-at       context-menu
// ==/UserScript==

(async function() {
	"use strict";
	var WebStore = class {
		storeOptions;
		thumbnailOptions;
		USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0";
		constructor(storeOptions, thumbnailOptions) {
			this.storeOptions = storeOptions;
			this.thumbnailOptions = thumbnailOptions;
		}
		isValid() {
			return !!this.MATCH_URL.exec(window.location.href);
		}
	};
	var GogStore = class extends WebStore {
		STORE_ID = "gog";
		MATCH_URL = /https:\/\/www\.gog\.com\/[a-z]{2}\/game\/([\w\W\-\_]+)/;
		async extractImages() {
			if (!this.MATCH_URL.exec(window.location.href)) return [];
			const gameArts = [];
			try {
				const productData = window.productcardData.cardProduct;
				[
					"galaxyBackgroundImage",
					"backgroundImage",
					"image",
					"boxArtImage",
					"logo"
				].forEach((key) => {
					let url = productData[key];
					if (!url) return;
					if (!url.endsWith(".jpg") && !url.endsWith(".png")) url += ".jpg";
					gameArts.push({
						purpose: key.replace("Image", ""),
						thumb: url.replace(".jpg", "_product_tile_256.jpg"),
						images: [{
							src: this.generateImageUrl(url),
							name: `full.png`
						}]
					});
				});
			} catch (e) {
				console.error(e);
			}
			return gameArts;
		}
		generateImageUrl(url, width) {
			return url.replace(".jpg", ".png");
		}
	};
	var NintendoStore = class extends WebStore {
		STORE_ID = "nintendo";
		MATCH_URL = /https:\/\/www\.nintendo\.com\/[a-z]{2}\/store\/products\/[\w\-]+/;
		async extractImages() {
			const scriptTags = document.querySelectorAll("script[type=\"application/ld+json\"]");
			for (const scriptTag of scriptTags) {
				let sku;
				try {
					sku = JSON.parse(scriptTag.innerHTML)["@graph"][0].sku;
				} catch (e) {
					continue;
				}
				const variables = {
					personalized: false,
					sku
				};
				const extensions = { persistedQuery: {
					version: 1,
					sha256Hash: "369a9c8cc97fb66d134f9aa89741166665dfdf5d82d23ce1b3fd61962482c181"
				} };
				const url = new URL("https://graph.nintendo.com/");
				url.searchParams.append("operationName", "ProductBySku");
				url.searchParams.append("variables", JSON.stringify(variables));
				url.searchParams.append("extensions", JSON.stringify(extensions));
				const options = {
					method: "GET",
					headers: {
						"User-Agent": this.USER_AGENT,
						"apollographql-client-name": "ncom",
						"apollographql-client-version": "1.0.0",
						"content-type": "application/json",
						"x-nintendo-graph": "true"
					}
				};
				try {
					const response = await fetch(url, options);
					const data = await response.json();
					if (response.status === 200) return this.processData(data);
				} catch (error) {
					console.error(error);
				}
			}
			return [];
		}
		processData(data) {
			const gameArts = [];
			try {
				const product = data.data.product;
				if (product.productImage) gameArts.push({
					purpose: "HeroArt",
					thumb: this.generateImageUrl(product.productImage.publicId, this.thumbnailOptions.width),
					images: [{
						name: "full.png",
						src: this.generateImageUrl(product.productImage.publicId)
					}]
				});
				if (product.productImageSquare) {
					let url = product.productImageSquare.url;
					const publicId = url.substring(url.indexOf("/store/"));
					gameArts.push({
						purpose: "SquareArt",
						thumb: this.generateImageUrl(publicId, this.thumbnailOptions.width),
						images: [{
							name: "full.png",
							src: this.generateImageUrl(publicId)
						}]
					});
				}
			} catch (e) {
				console.error(e);
			}
			return gameArts;
		}
		generateImageUrl(url, width, height) {
			let fullUrl = "https://assets.nintendo.com/image/upload/q_auto:best/f_png";
			if (width) fullUrl += `/w_${width}`;
			fullUrl += "/" + url;
			return fullUrl;
		}
	};
	var PlaystationStore = class extends WebStore {
		STORE_ID = "playstation";
		MATCH_URL = /https:\/\/store\.playstation\.com\/\w{2}-\w{2}\/(product|concept)\/([\w\-\_]+)/;
		async extractImages() {
			const match = this.MATCH_URL.exec(window.location.href);
			if (!match) return [];
			const productId = match[2];
			const scriptTags = document.querySelectorAll("script[type=\"application/json\"]");
			for (const scriptTag of scriptTags) {
				let media;
				try {
					const data = JSON.parse(scriptTag.innerHTML);
					media = (data.cache["Concept:" + productId] || data.cache["Product:" + productId]).media;
				} catch (e) {
					continue;
				}
				return this.mediaToGameArts(media);
			}
			return [];
		}
		generateImageUrl(url, width) {
			url = url + "?thumb=false";
			if (width) url += "&w=" + width;
			return url;
		}
		mediaToGameArts(media) {
			const gameArts = [];
			media.forEach((item) => {
				if (item.role === "SCREENSHOT" || item.role === "PREVIEW") return;
				gameArts.push({
					purpose: item.role,
					thumb: this.generateImageUrl(item.url, this.thumbnailOptions.width),
					images: [{
						src: this.generateImageUrl(item.url, 5e3),
						name: `full`
					}]
				});
			});
			return gameArts;
		}
	};
	var XboxStore = class extends WebStore {
		STORE_ID = "xbox";
		MATCH_URL = /https:\/\/www\.xbox\.com\/\w{2}-\w{2}\/\games\/store\/[\w\-]+\/(\w+)/;
		async extractImages() {
			const match = this.MATCH_URL.exec(window.location.href);
			if (!match) return [];
			const url = `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${match[1]}&market=${this.storeOptions.market}&languages=${this.storeOptions.language}`;
			const options = {
				method: "GET",
				headers: { "User-Agent": this.USER_AGENT }
			};
			try {
				const response = await fetch(url, options);
				const data = await response.json();
				if (response.status === 200) return this.processData(data);
			} catch (error) {
				console.error(error);
			}
			return [];
		}
		processData(data) {
			const gameArts = [];
			for (const product of data.Products) product.LocalizedProperties[0].Images.forEach((img) => {
				const purpose = img.ImagePurpose;
				if (["Screenshot"].indexOf(purpose) > -1) return;
				gameArts.push({
					purpose: img.ImagePurpose,
					thumb: this.generateImageUrl(img.Uri, img.Width, img.Width),
					images: [{
						src: this.generateImageUrl(img.Uri, img.Width, img.Height),
						name: `${img.Width}x${img.Height}.png`,
						width: img.Width,
						height: img.Height
					}]
				});
			});
			return gameArts;
		}
		generateImageUrl(url, width, height) {
			return `https:${url}?format=png&w=${width}&h=${height}`;
		}
	};
	var SteamStore = class extends WebStore {
		STORE_ID = "steam";
		MATCH_URL = /https:\/\/store\.steampowered\.com\/app\/(\d+)/;
		async extractImages() {
			const match = this.MATCH_URL.exec(window.location.href);
			if (!match) return [];
			const appId = match[1];
			const gameArts = [];
			try {
				const images = [
					"logo.png",
					"logo_2x.png",
					"header.jpg",
					"header_2x.jpg",
					"library_hero.jpg",
					"library_hero_2x.jpg",
					"library_hero_blur.jpg",
					"library_600x900.jpg",
					"library_600x900_2x.jpg",
					"capsule_616x353.jpg",
					"capsule_231x87.jpg",
					"hero_capsule.jpg",
					"page_bg_raw.jpg"
				];
				const time = +new Date();
				images.forEach((key) => {
					const img = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/${key}?t=${time}`;
					gameArts.push({
						purpose: key.split(".")[0],
						thumb: img,
						images: [{
							src: img,
							name: key
						}]
					});
				});
			} catch (e) {
				console.error(e);
			}
			return gameArts;
		}
		generateImageUrl(url, width) {
			return url;
		}
	};
	var main_default = ".game-art-downloader {\n    padding: 2rem 2rem 4rem;\n    margin: 0;\n    background-color: black;\n    color: white;\n    font-family: monospace;\n    font-size: 1rem;\n\n    a {\n        outline: none;\n        text-decoration: none;\n    }\n\n    &[data-store=\"xbox\"] {\n        --color-primary: #107c10;\n        --color-primary-content: #fff;\n    }\n\n    &[data-store=\"playstation\"] {\n        --color-primary: #003697;\n        --color-primary-content: #fff;\n    }\n\n    &[data-store=\"nintendo\"] {\n        --color-primary: #e60012;\n        --color-primary-content: #fff;\n    }\n\n    &[data-store=\"steam\"] {\n        --color-primary: #1a9fff;\n        --color-primary-content: #000;\n    }\n\n    &[data-store=\"gog\"] {\n        --color-primary: #da8bf0;\n        --color-primary-content: #000;\n    }\n\n    .header {\n        display: block;\n        font-size: 1.2rem;\n        font-weight: bold;\n        margin: 1rem;\n\n        a {\n            font-size: 0.75rem;\n            color: var(--color-primary);\n\n            &:hover {\n                text-decoration: underline;\n            }\n        }\n    }\n\n    .game-arts {\n        display: flex;\n        gap: 2rem;\n        flex-wrap: wrap;\n\n        .game-art {\n            &[data-broken=\"true\"] {\n                opacity: 0.5;\n                pointer-events: none;\n            }\n\n            fieldset {\n                background: #252525;\n                padding: 1rem;\n                border: 1px solid #393939;\n\n                legend {\n                    background: #363636;\n                    border: 1px solid #454545;\n                    color: white;\n                    padding: 0.125rem 0.375rem;\n                    margin: 0;\n                }\n\n                img {\n                    display: block;\n                    margin: 0 auto 1rem;\n                }\n\n                .links-container {\n                    margin-top: 0.5rem;\n                    display: flex;\n                    gap: 0.75rem;\n                    justify-content: center;\n\n                    a {\n                        color: white;\n                        background: black;\n                        padding: 0.125rem 0.625rem;\n\n                        &:hover {\n                            color: var(--color-primary-content);\n                            background-color: var(--color-primary);\n                        }\n                    }\n                }\n            }\n        }\n    }\n}\n";
	var CONFIGS = {
		thumbnail: { width: 150 },
		stores: {
			xbox: {
				market: "US",
				language: "english"
			},
			playstation: {
				market: "US",
				language: "english"
			},
			nintendo: {
				market: "US",
				language: "english"
			},
			gog: {
				market: "US",
				language: "english"
			},
			steam: {
				market: "US",
				language: "english"
			}
		}
	};
	var STORES = [
		new SteamStore(CONFIGS.stores.steam, CONFIGS.thumbnail),
		new XboxStore(CONFIGS.stores.xbox, CONFIGS.thumbnail),
		new PlaystationStore(CONFIGS.stores.playstation, CONFIGS.thumbnail),
		new NintendoStore(CONFIGS.stores.nintendo, CONFIGS.thumbnail),
		new GogStore(CONFIGS.stores.gog, CONFIGS.thumbnail)
	];
	var htmlEntities = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	};
	var HTML_ENTITY_PATTERN = /[&<>"']/g;
	function escape(value) {
		if (typeof value === "number") return value;
		return String(value).replace(HTML_ENTITY_PATTERN, (match) => htmlEntities[match]);
	}
	function renderGameArts(store, gameArts) {
		const $container = document.createElement("div");
		$container.className = "game-art-downloader";
		$container.dataset.store = store.STORE_ID;
		let html = [];
		html.push(`<div class="header"><span>Game Art Downloader 1.0.1-dev</span> <a href="https://github.com/redphx/game-art-downloader" target="_blank">github</a></div>`);
		html.push("<div class=\"game-arts\">");
		gameArts.sort((a, b) => a.purpose > b.purpose ? 1 : -1);
		gameArts.forEach((gameArt) => {
			const linksHtml = gameArt.images.map((item) => `<a href="${escape(item.src)}" target="_blank">${escape(item.name)}</a>`).join("");
			html.push(`
<div class="game-art">
    <fieldset>
        <legend>${escape(gameArt.purpose)}</legend>
        <img width="${escape(CONFIGS.thumbnail.width)}" src="${escape(gameArt.thumb)}" onerror="gadOnImageError(this)" />

        <div class="links-container">${linksHtml}</div>
    </fieldset>
</div>
`);
		});
		html.push("</div>");
		$container.innerHTML = html.join("");
		document.documentElement.append($container);
		setTimeout(() => $container.scrollIntoView(false), 100);
	}
	window.gadOnImageError = ($img) => {
		const $parent = $img.closest(".game-art");
		$parent.dataset.broken = "true";
	};
	var $style = document.createElement("style");
	$style.innerHTML = main_default;
	document.documentElement.append($style);
	for (var store of STORES) {
		if (!store.isValid()) continue;
		const gameArts = await(store.extractImages());
		if (gameArts.length) renderGameArts(store, gameArts);
	}
})();
