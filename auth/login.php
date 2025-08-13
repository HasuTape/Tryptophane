<?php
include '../db.php';
include '../jwt.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'];
    $pass = $_POST['password'];
    $stmt = $conn->prepare("SELECT id, password_hash FROM users WHERE email=?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->bind_result($id, $hash);
    if ($stmt->fetch() && password_verify($pass, $hash)) {
        $jwt = create_jwt($id);
        setcookie("token", $jwt, time()+3600, "/");
        header("Location: ../profile.php");
        exit;
    } else {
        $error = "Błędny email lub hasło!";
    }
}
?>
<form method="POST">
    Email: <input name="email" required><br>
    Hasło: <input type="password" name="password" required><br>
    <button type="submit">Zaloguj</button>
</form>
<?php if (isset($error)) echo $error; ?>
