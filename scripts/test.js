const Dictionary = 'abcdefghijklmnopqrstuvwxyz';

function _get26Num(number){
  let result = '';

  while(number > 0) {
      result += Dictionary.charAt(number % Dictionary.length);
      number = parseInt(number / Dictionary.length);
  }

  return result;
}

console.log('Result: ', _get26Num(5));