const MAX_AUTOCOMPLETE_CHOICES = 25;

function filterAutocompleteChoices(items, focusedValue, getName = item => item.name) {
	const query = String(focusedValue ?? '').trim().toLowerCase();
	return items
		.filter(item => {
			const name = String(getName(item));
			const value = String(item.value ?? name);
			return !query
				|| name.toLowerCase().includes(query)
				|| value.toLowerCase().includes(query);
		})
		.slice(0, MAX_AUTOCOMPLETE_CHOICES)
		.map(item => {
			const name = String(getName(item)).slice(0, 100);
			const value = item.value ?? getName(item);
			return { name, value };
		});
}

module.exports = { filterAutocompleteChoices, MAX_AUTOCOMPLETE_CHOICES };
