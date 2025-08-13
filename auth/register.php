<?php
include '../db.php';
include '../jwt.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'];
    $pass = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (email, password_hash) VALUES (?,?)");
    $stmt->bind_param("ss", $email, $pass);
    if ($stmt->execute()) {
        $user_id = $stmt->insert_id;
        $jwt = create_jwt($user_id);
        setcookie("token", $jwt, time()+3600, "/");
        header("Location: ../profile.php");
        exit;
    } else {
        $error = "Błąd rejestracji: " . $conn->error;
    }
}
?>
<form method="POST">
    Email: <input name="email" required><br>
    Hasło: <input type="password" name="password" required><br>
    <button type="submit">Zarejestruj</button>
</form>
<?php if (isset($error)) echo $error; ?>
