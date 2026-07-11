document.addEventListener('DOMContentLoaded', () => {
  (function () {
    const overlay = document.querySelector('[data-quick-view-overlay]');
    if (!overlay) return;
    const modal = overlay.querySelector('.quick-view-modal');
    const closeButton = modal.querySelector('[data-quick-view-close]');
    const addToCartButton = modal.querySelector('[data-quick-view-atc]');
    const addToCartLabel = modal.querySelector('[data-quick-view-atc-label]');
    const stockMsgEl = modal.querySelector('[data-quick-view-stock-msg]');

    // Elements to populate
    const titleEl = modal.querySelector('[data-quick-view-title]');
    const priceEl = modal.querySelector('[data-quick-view-price]');
    const imageEl = modal.querySelector('[data-quick-view-image]');
    const descriptionEl = modal.querySelector('[data-quick-view-description]');
    const colorWrapEl = modal.querySelector('[data-quick-view-color]');
    const sizeSelectEl = modal.querySelector('[data-quick-view-size]');

    // Config for the hidden auto-add rule, set in Liquid via data attributes
    const autoAddVariantId = overlay.dataset.autoAddVariantId || '';
    const autoAddColor = (overlay.dataset.autoAddColor || '').toLowerCase();
    const autoAddSize = (overlay.dataset.autoAddSize || '').toLowerCase();

    // Current product state, rebuilt every time a trigger is clicked
    let state = {
      variants: [],
      colorIndex: -1, // which option slot (0/1/2 -> option1/2/3) is "Color"
      sizeIndex: -1,  // which option slot is "Size"
      selectedColor: null,
      selectedSize: null,
      baseImage: '',
      basePrice: ''
    };

    function optionKey(index) {
      return 'option' + (index + 1);
    }

    function findMatchingVariant() {
      return state.variants.find((variant) => {
        const colorOk = state.colorIndex === -1 || variant[optionKey(state.colorIndex)] === state.selectedColor;
        const sizeOk = state.sizeIndex === -1 || variant[optionKey(state.sizeIndex)] === state.selectedSize;
        return colorOk && sizeOk;
      });
    }

    function isCombinationAvailable(color, size) {
      return state.variants.some((variant) => {
        const colorOk = state.colorIndex === -1 || variant[optionKey(state.colorIndex)] === color;
        const sizeOk = state.sizeIndex === -1 || (size == null ? true : variant[optionKey(state.sizeIndex)] === size);
        return colorOk && sizeOk && variant.available;
      });
    }

    function renderColorSwatches() {
      colorWrapEl.innerHTML = '';
      if (state.colorIndex === -1) return;

      const colors = [...new Set(state.variants.map((v) => v[optionKey(state.colorIndex)]))];
      colors.forEach((color) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'quick-view-swatch';
        swatch.textContent = color;
        swatch.dataset.color = color;
        if (!isCombinationAvailable(color, null)) {
          swatch.dataset.unavailable = 'true';
        }
        if (color === state.selectedColor) {
          swatch.dataset.selected = 'true';
        }
        swatch.addEventListener('click', () => {
          if (swatch.dataset.unavailable === 'true') return;
          state.selectedColor = color;
          renderColorSwatches();
          renderSizeOptions();
          updateSelection();
        });
        colorWrapEl.appendChild(swatch);
      });
    }

    function renderSizeOptions() {
      sizeSelectEl.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Choose your size';
      sizeSelectEl.appendChild(placeholder);

      if (state.sizeIndex === -1) {
        sizeSelectEl.disabled = true;
        return;
      }
      sizeSelectEl.disabled = false;

      const sizes = [...new Set(state.variants.map((v) => v[optionKey(state.sizeIndex)]))];
      sizes.forEach((size) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        if (!isCombinationAvailable(state.selectedColor, size)) {
          option.disabled = true;
          option.textContent = size + ' (Sold out)';
        }
        if (size === state.selectedSize) {
          option.selected = true;
        }
        sizeSelectEl.appendChild(option);
      });

      // Reset the selection if it's no longer valid for the chosen color
      if (state.selectedSize && !isCombinationAvailable(state.selectedColor, state.selectedSize)) {
        state.selectedSize = null;
        sizeSelectEl.value = '';
      }
    }

    function updateSelection() {
      const variant = findMatchingVariant();

      if (variant) {
        priceEl.textContent = variant.price || state.basePrice;
        if (variant.image) imageEl.src = variant.image;
      } else {
        priceEl.textContent = state.basePrice;
      }

      const needsColor = state.colorIndex !== -1 && !state.selectedColor;
      const needsSize = state.sizeIndex !== -1 && !state.selectedSize;

      if (needsColor || needsSize) {
        addToCartButton.disabled = true;
        addToCartLabel.textContent = 'Select options';
        stockMsgEl.hidden = true;
      } else if (!variant || !variant.available) {
        addToCartButton.disabled = true;
        addToCartLabel.textContent = 'Sold out';
        stockMsgEl.hidden = false;
        stockMsgEl.textContent = 'That combination is currently out of stock.';
      } else {
        addToCartButton.disabled = false;
        addToCartLabel.textContent = 'Add to Cart';
        stockMsgEl.hidden = true;
      }
    }

    const quickViewContainer = document.querySelector('[data-quick-view-container]');
    if (quickViewContainer) {
      quickViewContainer.addEventListener('click', function (event) {
        const button = event.target.closest('[data-quick-view-trigger]');
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        let variants = [];
        let optionNames = [];
        try {
          variants = JSON.parse(button.dataset.variants || '[]');
        } catch (err) {
          console.error('Quick view: failed to parse variant data for', button.dataset.title, err, button.dataset.variants);
          variants = [];
        }
        try {
          optionNames = JSON.parse(button.dataset.options || '[]');
        } catch (err) {
          console.error('Quick view: failed to parse option data for', button.dataset.title, err, button.dataset.options);
          optionNames = [];
        }

        state = {
          variants,
          colorIndex: optionNames.findIndex((name) => (name || '').toLowerCase() === 'color'),
          sizeIndex: optionNames.findIndex((name) => (name || '').toLowerCase() === 'size'),
          selectedColor: null,
          selectedSize: null,
          baseImage: button.dataset.image || '',
          basePrice: button.dataset.price || ''
        };

        titleEl.textContent = button.dataset.title || '';
        priceEl.textContent = state.basePrice;
        imageEl.src = state.baseImage;
        imageEl.alt = button.dataset.title || '';
        descriptionEl.textContent = button.dataset.description || '';

        // If there's only one color/size, auto-select it so the shopper
        // isn't forced to click something with no real choice.
        if (state.colorIndex !== -1) {
          const colors = [...new Set(variants.map((v) => v[optionKey(state.colorIndex)]))];
          if (colors.length === 1) state.selectedColor = colors[0];
        }
        if (state.sizeIndex !== -1) {
          const sizes = [...new Set(variants.map((v) => v[optionKey(state.sizeIndex)]))];
          if (sizes.length === 1) state.selectedSize = sizes[0];
        }

        renderColorSwatches();
        renderSizeOptions();
        updateSelection();

        overlay.hidden = false;
      });
    }

    sizeSelectEl.addEventListener('change', () => {
      state.selectedSize = sizeSelectEl.value || null;
      updateSelection();
    });

    // Close the modal
    closeButton.addEventListener('click', function () {
      overlay.hidden = true;
    });
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) overlay.hidden = true;
    });

    // AJAX add to cart, with the hidden Black + Medium auto-add rule
    addToCartButton.addEventListener('click', function () {
      const variant = findMatchingVariant();
      if (!variant || !variant.available) return;

      const items = [{ id: variant.id, quantity: 1 }];

      const colorMatches = (state.selectedColor || '').toLowerCase() === autoAddColor;
      const sizeMatches = (state.selectedSize || '').toLowerCase() === autoAddSize;
      if (colorMatches && sizeMatches && autoAddVariantId) {
        items.push({ id: Number(autoAddVariantId), quantity: 1 });
      }

      const originalLabel = addToCartLabel.textContent;
      addToCartButton.disabled = true;
      addToCartLabel.textContent = 'Adding...';

      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items })
      })
        .then((response) => {
          if (!response.ok) throw new Error('Add to cart failed');
          return response.json();
        })
        .then(() => {
          document.dispatchEvent(new CustomEvent('cart:updated'));
          addToCartLabel.textContent = 'Added!';
          setTimeout(() => {
            overlay.hidden = true;
            addToCartButton.disabled = false;
            addToCartLabel.textContent = originalLabel;
          }, 700);
        })
        .catch(() => {
          addToCartButton.disabled = false;
          addToCartLabel.textContent = originalLabel;
          stockMsgEl.hidden = false;
          stockMsgEl.textContent = "Couldn't add that to your cart, please try again.";
        });
    });
  })();
});