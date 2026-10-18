/**
 * The histogram of the filter editor as data (FE-026, FE-035, BE-004): a
 * port of the legacy `renderFilterHistogram`/`paint` texts and numbers, so
 * the component only draws.
 */
import {
	countInRange,
	cycleMode,
	filterTypeOf,
	histogramBins,
	keptEntities,
	rangeScale,
	type KeptEntity,
	type RangeScale
} from '#lib/domain/legacy/query-calculations.js';
import type { NumericProfile } from '#lib/api/client.js';

export type ProfileModel =
	| { kind: 'message'; text: string }
	| {
			kind: 'histogram';
			profile: NumericProfile;
			numbers: number[];
			scale: RangeScale;
			total: number;
			omitted: number;
			sampleMax: number;
			binCount: number;
			single: boolean;
			format: (value: number) => string;
			notes: string[];
	  };

export function profileModel(profile: NumericProfile): ProfileModel {
	const numbers = (profile.values || [])
		.map((item) => Number(item.number))
		.filter(Number.isFinite);
	const scale = rangeScale(numbers);
	if (!scale)
		return {
			kind: 'message',
			text: 'No numeric values for this relation under the rest of the query.'
		};
	const total = Math.max(profile.count || 0, numbers.length);
	const format = (value: number) => String(Number(value.toFixed(scale.decimals)));
	const sampleMax = Math.max(...numbers);
	const single = scale.min === scale.max;
	const notes: string[] = [];
	if (single) notes.push(`All ${total} values are ${format(scale.min)}.`);
	if (profile.truncated) {
		notes.push(
			`The histogram covers the lowest ${numbers.length} of ${total} values (up to ${format(sampleMax)}${profile.max != null ? `; the largest is ${profile.max}` : ''}).`
		);
	}
	return {
		kind: 'histogram',
		profile,
		numbers,
		scale,
		total,
		omitted: profile.truncated ? total - numbers.length : 0,
		sampleMax,
		binCount: Math.min(24, new Set(numbers).size),
		single,
		format,
		notes
	};
}

export type Paint = {
	bars: {
		from: string;
		to: string;
		count: number;
		kept: number;
		x: number;
		width: number;
		height: number;
		keptHeight: number;
	}[];
	countText: string;
	rangeText: string;
	fillLeft: number;
	fillRight: number;
	loOnTop: boolean;
	/** Null when the kept entities cannot be cycled (text filters, unknown maximum). */
	range: { lo: number; hi: number } | null;
	extreme: { kind: 'lowest' | 'highest'; value: number | null } | null;
	unknownMax: boolean;
};

/** One drawing of the histogram for the editor's filter type, value and handles. */
export function paint(
	model: Extract<ProfileModel, { kind: 'histogram' }>,
	filterType: string,
	value: string,
	lo: number,
	hi: number
): Paint {
	const { numbers, scale, profile, sampleMax, omitted, total, format, binCount } = model;
	const code = filterTypeOf(filterType);
	const extreme =
		code === 5
			? { kind: 'lowest' as const, value: Math.min(...numbers) }
			: code === 4
				? { kind: 'highest' as const, value: profile.truncated ? null : sampleMax }
				: null;
	const unknownMax = extreme !== null && extreme.value === null;
	const text = value.trim();
	const exact =
		cycleMode(filterType) === 'exact' && text !== '' && Number.isFinite(Number(text))
			? Number(text)
			: null;
	const fixed = exact ?? extreme?.value ?? null;
	const a = unknownMax ? Infinity : (fixed ?? lo);
	const b = unknownMax ? Infinity : (fixed ?? hi);
	const bins = histogramBins(numbers, { min: scale.min, max: scale.max, lo: a, hi: b, binCount });
	const tallest = Math.max(...bins.map((bin) => bin.count));
	const width = 300 / bins.length;
	const highOpen = fixed === null && !unknownMax && b >= scale.max;
	const keptCount = countInRange(numbers, a, b) + (highOpen ? omitted : 0);
	const atLeast = profile.truncated && !highOpen && b >= sampleMax ? 'at least ' : '';
	const span = scale.max - scale.min || 1;
	const cyclable = !unknownMax && (extreme !== null || cycleMode(filterType) !== null);
	return {
		bars: bins.map((bin, index) => ({
			from: format(bin.from),
			to: format(bin.to),
			count: bin.count,
			kept: bin.kept,
			x: index * width + 0.5,
			width: Math.max(width - 1, 0.5),
			height: (bin.count / tallest) * 70,
			keptHeight: (bin.kept / tallest) * 70
		})),
		countText: unknownMax
			? `Keeps the highest value (${profile.max ?? '?'})`
			: `Keeps ${atLeast}${keptCount} of ${total} values`,
		rangeText: unknownMax ? `> ${format(sampleMax)}` : `${format(a)} – ${format(b)}`,
		fillLeft: ((lo - scale.min) / span) * 100,
		fillRight: ((scale.max - hi) / span) * 100,
		loOnTop: lo >= scale.max,
		range: cyclable ? { lo: a, hi: b } : null,
		extreme,
		unknownMax
	};
}

/** Kept entities and the note under the cycle (FE-035). */
export function keptView(
	model: Extract<ProfileModel, { kind: 'histogram' }>,
	drawn: Paint
): { kept: KeptEntity[]; note: string } {
	const kept = drawn.range
		? keptEntities(model.profile.values || [], drawn.range.lo, drawn.range.hi)
		: [];
	const count = `${kept.length} ${kept.length === 1 ? 'entity' : 'entities'}`;
	const sampled = model.profile.truncated
		? ` (from the ${model.numbers.length} loaded values)`
		: '';
	const note = drawn.unknownMax
		? `The highest value is ${model.profile.max ?? '?'}; its entities are known after the query runs.`
		: drawn.extreme
			? `${count} ${kept.length === 1 ? 'has' : 'have'} the ${drawn.extreme.kind} value; the query returns all of them, up to the server limit.`
			: !kept.length
				? 'No entity is kept.'
				: `${kept.length} kept ${kept.length === 1 ? 'entity' : 'entities'}${sampled}.`;
	return { kept, note };
}

export const CYCLE_PAGE = 5;
export const CYCLE_INTERVAL_MS = 1600;
