export const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('pt-BR', options);
};

export const formatDateInput = (dateString) => {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};
