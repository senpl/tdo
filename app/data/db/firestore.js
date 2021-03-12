import "firebase/firestore";

import { firebase,firestore } from "./firebase";

firestore.settings({
    timestampsInSnapshots: true
})

export default firestore;

// firestore.settings(settings);


