import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Не заполнены все поля" }, { status: 400 });
    }

    // Query for the user by email, including owned and assigned businesses
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        businessId: true,
        isActive: true,
        business: { select: { id: true, slug: true } },
        ownedBusinesses: { select: { id: true, slug: true } },
      },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    // Securely compare password hash using bcryptjs
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Пользователь заблокирован" }, { status: 403 });
    }

    // Find the business related to this user
    const relatedBusiness = user.business || user.ownedBusinesses[0] || null;

    const userData = {
      id: user.id,
      email: user.email,
      role: user.role, // SUPER_ADMIN, BUSINESS_OWNER, MANAGER, etc.
      businessId: relatedBusiness ? relatedBusiness.id : null,
      businessSlug: relatedBusiness ? relatedBusiness.slug : null,
    };

    const token = "token-" + user.id + "-" + Date.now();

    const response = NextResponse.json({
      success: true,
      user: userData,
      token,
    });

    // Set server-side cookies for NextJS middleware compatibility
    response.cookies.set("adminUser", JSON.stringify(userData), { 
      path: "/", 
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    });
    
    response.cookies.set("accessToken", token, { 
      path: "/", 
      maxAge: 60 * 60 * 24, 
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Ошибка сервера при входе" }, { status: 500 });
  }
}
