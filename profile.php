<?php
include 'db.php';
include 'jwt.php';

if (!isset($_COOKIE['token']) || !($user_id = verify_jwt($_COOKIE['token']))) {
    header("Location: auth/login.php");
    exit;
}
$stmt = $conn->prepare("SELECT email, pw, pn FROM users WHERE id=?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$stmt->bind_result($email, $pw, $pn);
$stmt->fetch();
?>
<h2>Profil: <?php echo htmlspecialchars($email); ?></h2>
<p>Reputacja: <?php echo $pw - $pn; ?> (PW: <?php echo $pw; ?>, PN: <?php echo $pn; ?>)</p>
<a href="videos/upload.php">Dodaj film</a> | <a href="videos/index.php">Lista filmów</a>
