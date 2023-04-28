const ALL_RANDOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz!_$';
const randomString = (len) => {
  const randomArray = Array.from(
    { length: len },
    (v, k) => ALL_RANDOM_CHARS[Math.floor(Math.random() * ALL_RANDOM_CHARS.length)]
  );

  return randomArray.join("");
};




module.exports = {
  randomString
};