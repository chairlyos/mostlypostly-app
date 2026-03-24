export function requireAuth(req, res, next) {
  if (!req.session?.manager_id || !req.manager) {
    return res.redirect("/manager/login");
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.manager?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).send("Access denied");
    }
    next();
  };
}
