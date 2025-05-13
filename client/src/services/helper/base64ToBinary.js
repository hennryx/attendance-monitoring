// Convert base64 to binary
const base64ToBinary = (base64Image) => {
  const base64Data = base64Image.includes(",")
    ? base64Image.split(",")[1]
    : base64Image;

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
};

export default base64ToBinary;
