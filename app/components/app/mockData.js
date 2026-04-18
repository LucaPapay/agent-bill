export const avatarColors = {
  You: '#F6B533',
  Sarah: '#FF5436',
  Miles: '#8FC56A',
  Priya: '#B9A6E8',
  Jordan: '#7FB8D9',
  Alex: '#E89E6C',
  Kai: '#D9B38F',
}

export const people = ['You', 'Sarah', 'Miles', 'Priya']

export const sampleBill = {
  merchant: "Tuca's Tapas",
  location: 'East Village · NY',
  date: 'Apr 17 · 8:42 PM',
  items: [
    { id: 'i1', name: 'Patatas bravas', qty: 1, price: 11 },
    { id: 'i2', name: 'Gambas al ajillo', qty: 1, price: 16.5 },
    { id: 'i3', name: 'Jamón board', qty: 1, price: 22 },
    { id: 'i4', name: 'Croquetas (x4)', qty: 1, price: 14 },
    { id: 'i5', name: 'Tortilla española', qty: 1, price: 13 },
    { id: 'i6', name: 'Glass of Tempranillo', qty: 2, price: 28 },
    { id: 'i7', name: 'Sangría pitcher', qty: 1, price: 32 },
    { id: 'i8', name: 'Flan', qty: 1, price: 9 },
  ],
  subtotal: 145.5,
  tax: 12.9,
  tip: 26,
  total: 184.4,
}

export const initialAssignments = {
  i1: ['You', 'Sarah', 'Miles', 'Priya'],
  i2: ['Miles', 'Priya'],
  i3: ['You', 'Sarah', 'Miles', 'Priya'],
  i4: ['You', 'Sarah'],
  i5: ['Sarah', 'Priya'],
  i6: ['You', 'Miles'],
  i7: ['You', 'Sarah', 'Miles', 'Priya'],
  i8: ['Priya'],
}
