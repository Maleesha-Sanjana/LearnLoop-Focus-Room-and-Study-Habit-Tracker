import {auth} from "./firebase.js";


import {
createUserWithEmailAndPassword,
sendEmailVerification
}
from 
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



const register = document.getElementById("register");


register.addEventListener("click", async()=>{


let email = document.getElementById("email").value;

let password = document.getElementById("password").value;



try{


const userCredential =
await createUserWithEmailAndPassword(
auth,
email,
password
);



await sendEmailVerification(
userCredential.user
);



alert(
"Verification email sent. Check your email!"
);



}


catch(error){

alert(error.message);

}


});