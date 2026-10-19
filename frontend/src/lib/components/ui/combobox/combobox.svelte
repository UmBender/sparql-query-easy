<!--
	A text input with a list of suggestions (ARIA 1.2 combobox): Search nodes,
	filter text suggestions. The caller owns the items (usually fetched while
	typing); Arrow keys move, Enter chooses, Escape closes.
-->
<script lang="ts" module>
	export type ComboboxItem = { value: string; label: string; hint?: string };
</script>

<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { cn } from '#lib/utils.js';

	let {
		id,
		label,
		items,
		text = $bindable(''),
		placeholder,
		status,
		onselect,
		oninput,
		class: className,
		inputClass,
		disabled = false
	}: {
		id: string;
		label: string;
		items: ComboboxItem[];
		text?: string;
		placeholder?: string;
		/** Shown in the list when there are no items (loading, empty, error). */
		status?: string;
		onselect: (item: ComboboxItem) => void;
		/** Called with the text after each keystroke. */
		oninput?: (text: string) => void;
		class?: string;
		inputClass?: string;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let active = $state(-1);
	const listId = $derived(`${id}-list`);
	const showList = $derived(open && (items.length > 0 || Boolean(status)));

	function choose(item: ComboboxItem) {
		open = false;
		active = -1;
		onselect(item);
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!items.length) return;
			event.preventDefault();
			open = true;
			const step = event.key === 'ArrowDown' ? 1 : -1;
			active = (active + step + items.length) % items.length;
		} else if (event.key === 'Enter' && open && active >= 0 && items[active]) {
			event.preventDefault();
			choose(items[active]);
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			open = false;
			active = -1;
		}
	}
</script>

<div data-slot="combobox" class={cn('relative', className)}>
	<Input
		{id}
		role="combobox"
		aria-label={label}
		aria-expanded={showList}
		aria-controls={listId}
		aria-autocomplete="list"
		aria-activedescendant={showList && active >= 0 ? `${id}-option-${active}` : undefined}
		autocomplete="off"
		{placeholder}
		{disabled}
		class={inputClass}
		bind:value={text}
		oninput={() => {
			open = true;
			active = -1;
			oninput?.(text);
		}}
		onkeydown={keydown}
		onblur={() => setTimeout(() => (open = false), 150)}
	/>
	<ul
		id={listId}
		role="listbox"
		aria-label={label}
		hidden={!showList}
		class="absolute top-full right-0 left-0 z-(--z-menu) mt-1 max-h-72 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
	>
		{#each items as item, index (item.value)}
			<li
				id="{id}-option-{index}"
				role="option"
				aria-selected={index === active}
				class="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
				onmousedown={(event) => {
					event.preventDefault();
					choose(item);
				}}
				onmouseenter={() => (active = index)}
			>
				<span>{item.label}</span>
				{#if item.hint}<span class="text-xs text-muted-foreground">{item.hint}</span>{/if}
			</li>
		{/each}
		{#if !items.length && status}
			<li role="presentation" class="px-2 py-1.5 text-sm text-muted-foreground">{status}</li>
		{/if}
	</ul>
</div>
