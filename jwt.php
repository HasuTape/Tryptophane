<?php
// Uproszczone JWT – tylko do demonstracji, nie do produkcji!
function create_jwt($user_id) {
    return base64_encode("user:$user_id:".time());
}
function verify_jwt($token) {
    $data = explode(':', base64_decode($token));
    if (count($data) >= 2 && $data[0] === 'user') {
        return intval($data[1]);
    }
    return false;
}
?>
