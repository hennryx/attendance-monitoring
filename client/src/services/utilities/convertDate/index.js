
function toDate(isoDate) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      const formatted = new Date(isoDate).toLocaleString('en-US', options);

      return formatted
}

export default toDate;