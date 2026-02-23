'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hero } from '@/components/ui/animated-hero';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, Users, BarChart3, Shield, Zap, Globe, Smartphone, Database, TrendingUp, Clock, HeadphonesIcon, Sparkles, Rocket, Brain, Cpu, Network, Layers, Play, ArrowRight } from 'lucide-react';
import ShaderBackground from '@/components/ui/shader-background';
import { useTheme } from 'next-themes';

import './landing.css';

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState<{ [key: string]: boolean }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setIsLoaded(true);
    // Force light theme for landing page
    if (theme !== 'light') {
      setTheme('light');
    }

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    // Scroll tracking
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    // Intersection Observer for scroll animations
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    // Observe elements for scroll animations
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el) => {
      if (observerRef.current) {
        observerRef.current.observe(el);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden gpu-accelerated font-sans">
      {/* Enhanced Navigation */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-xl border-b border-gray-200 z-50 transition-all duration-300 will-change-transform">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 group">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 will-change-transform shadow-sm">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-slate-800 group-hover:text-purple-600 transition-colors duration-300">InventryPro</span>
            </div>

            <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
              <Link href="#features" className="text-slate-600 hover:text-purple-600 font-medium transition-all duration-300 hover:scale-105 relative group">
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="#pricing" className="text-slate-600 hover:text-purple-600 font-medium transition-all duration-300 hover:scale-105 relative group">
                Pricing
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="#about" className="text-slate-600 hover:text-purple-600 font-medium transition-all duration-300 hover:scale-105 relative group">
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link href="#testimonials" className="text-slate-600 hover:text-purple-600 font-medium transition-all duration-300 hover:scale-105 relative group">
                Reviews
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-700 hover:bg-slate-100 hover:text-purple-600 font-medium transition-all duration-300 text-xs sm:text-sm px-2 sm:px-3">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 text-xs sm:text-sm px-2 sm:px-3 will-change-transform">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Animated Hero Section with Shader Background */}
      <section className="pt-20 sm:pt-24 relative z-10 overflow-hidden min-h-[80vh] flex items-center justify-center">
        <ShaderBackground className="absolute inset-0 w-full h-full -z-10" />
        <div className="relative z-10 w-full">
          <Hero />
        </div>
      </section>

      {/* Container Scroll Animation Section */}
      <div className="flex flex-col overflow-hidden z-10 relative">
        <ContainerScroll
          titleComponent={
            <>
              <h1 className="text-4xl font-semibold text-slate-800">
                Unleash the power of <br />
                <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                  Smart Inventory
                </span>
              </h1>
            </>
          }
        >
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
            alt="Dashboard Preview"
            className="mx-auto rounded-2xl object-cover h-full w-full object-left-top"
            draggable={false}
          />
        </ContainerScroll>
      </div>

      {/* Enhanced Stats Section */}
      <section className="py-8 sm:py-12 bg-white/40 backdrop-blur-sm border-y border-gray-100 z-10 relative" data-animate="stats">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '0ms' }}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">10,000+</div>
              <div className="text-slate-600 font-medium text-xs sm:text-sm group-hover:text-purple-600 transition-colors duration-300">Active Users</div>
            </div>
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '100ms' }}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">50M+</div>
              <div className="text-slate-600 font-medium text-xs sm:text-sm group-hover:text-blue-600 transition-colors duration-300">Products Tracked</div>
            </div>
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '200ms' }}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-600 to-green-600 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">99.9%</div>
              <div className="text-slate-600 font-medium text-xs sm:text-sm group-hover:text-cyan-600 transition-colors duration-300">Uptime</div>
            </div>
            <div className={`group transition-all duration-1000 ${isVisible.stats ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '300ms' }}>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-purple-600 bg-clip-text text-transparent mb-1 sm:mb-2 group-hover:scale-110 transition-transform duration-300">24/7</div>
              <div className="text-slate-600 font-medium text-xs sm:text-sm group-hover:text-green-600 transition-colors duration-300">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section id="features" className="py-16 sm:py-20 relative z-10" data-animate="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-800 mb-4 transition-all duration-1000 ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              Everything You Need to Manage Your Inventory
            </h2>
            <p className={`text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto transition-all duration-1000 delay-200 ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              Powerful features designed to streamline your inventory management and boost your business efficiency.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            <Card className={`border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-500/10 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '0ms' }}>
              <CardHeader className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-300 shadow-inner">
                  <Database className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" />
                </div>
                <CardTitle className="text-slate-800 group-hover:text-purple-600 transition-colors duration-300 text-lg sm:text-xl md:text-2xl font-bold">Multi-Shop Management</CardTitle>
                <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300 text-sm sm:text-base leading-relaxed mt-2">
                  Manage inventory across multiple locations, shops, and warehouses from a single dashboard.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className={`border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-blue-500/10 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '100ms' }}>
              <CardHeader className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-300 shadow-inner">
                  <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                </div>
                <CardTitle className="text-slate-800 group-hover:text-blue-600 transition-colors duration-300 text-lg sm:text-xl md:text-2xl font-bold">Real-Time Analytics</CardTitle>
                <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300 text-sm sm:text-base leading-relaxed mt-2">
                  Get instant insights into sales trends, stock levels, and business performance with live dashboards.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className={`border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-cyan-500/10 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '200ms' }}>
              <CardHeader className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-cyan-100 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-300 shadow-inner">
                  <Smartphone className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-600" />
                </div>
                <CardTitle className="text-slate-800 group-hover:text-cyan-600 transition-colors duration-300 text-lg sm:text-xl md:text-2xl font-bold">Mobile-First Design</CardTitle>
                <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300 text-sm sm:text-base leading-relaxed mt-2">
                  Access your inventory anywhere with our responsive, mobile-optimized interface.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className={`border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-green-500/10 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '300ms' }}>
              <CardHeader className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-300 shadow-inner">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 text-green-600" />
                </div>
                <CardTitle className="text-slate-800 group-hover:text-green-600 transition-colors duration-300 text-lg sm:text-xl md:text-2xl font-bold">Customer Management</CardTitle>
                <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300 text-sm sm:text-base leading-relaxed mt-2">
                  Track customer purchases, manage credit accounts, and maintain detailed customer ledgers.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className={`border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-500/10 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '400ms' }}>
              <CardHeader className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-pink-100 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-300 shadow-inner">
                  <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-pink-600" />
                </div>
                <CardTitle className="text-slate-800 group-hover:text-pink-600 transition-colors duration-300 text-lg sm:text-xl md:text-2xl font-bold">Enterprise Security</CardTitle>
                <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300 text-sm sm:text-base leading-relaxed mt-2">
                  Bank-level security with role-based access control and data encryption.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className={`border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-pink-500/10 group ${isVisible.features ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: '500ms' }}>
              <CardHeader className="p-6 sm:p-8">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-sky-100 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:rotate-12 transition-transform duration-300 shadow-inner">
                  <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-sky-600" />
                </div>
                <CardTitle className="text-slate-800 group-hover:text-sky-600 transition-colors duration-300 text-lg sm:text-xl md:text-2xl font-bold">Multi-Language Support</CardTitle>
                <CardDescription className="text-slate-600 group-hover:text-slate-700 transition-colors duration-300 text-sm sm:text-base leading-relaxed mt-2">
                  Available in multiple languages including Hindi and English for global accessibility.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-20 bg-slate-50 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-800 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              Choose the plan that fits your business needs. Upgrade or downgrade anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <Card className="border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-500/10 group">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl md:text-2xl text-slate-800 group-hover:text-purple-600 transition-colors duration-300">Starter</CardTitle>
                <CardDescription className="text-slate-500 group-hover:text-slate-600 transition-colors duration-300">Perfect for small businesses</CardDescription>
                <div className="mt-6 mb-2">
                  <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">₹999</span>
                  <span className="text-slate-500 font-medium ml-1">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 mb-8 px-2">
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Up to 1,000 products</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>1 shop location</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Basic reporting</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Email support</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Mobile app access</span>
                  </li>
                </ul>
                <Link href="/signup" className="block w-full">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25" size="lg">
                    Start Free Trial
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Professional Plan */}
            <Card className="border-2 border-purple-500 relative bg-white transition-all duration-500 hover:-translate-y-2 shadow-xl shadow-purple-500/10 group scale-105 z-10">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-md py-1 px-3">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <CardTitle className="text-xl md:text-2xl text-slate-800 group-hover:text-purple-600 transition-colors duration-300">Professional</CardTitle>
                <CardDescription className="text-slate-500 group-hover:text-slate-600 transition-colors duration-300">Ideal for growing businesses</CardDescription>
                <div className="mt-6 mb-2">
                  <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">₹2,499</span>
                  <span className="text-slate-500 font-medium ml-1">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 mb-8 px-2">
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Up to 10,000 products</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Up to 5 shop locations</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Advanced analytics</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>API access</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Custom reports</span>
                  </li>
                </ul>
                <Link href="/signup" className="block w-full">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-purple-500/25" size="lg">
                    Start Free Trial
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border border-gray-200 bg-white/70 backdrop-blur-md hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-blue-500/10 group">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl md:text-2xl text-slate-800 group-hover:text-blue-600 transition-colors duration-300">Enterprise</CardTitle>
                <CardDescription className="text-slate-500 group-hover:text-slate-600 transition-colors duration-300">For large organizations</CardDescription>
                <div className="mt-6 mb-2">
                  <span className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">₹4,999</span>
                  <span className="text-slate-500 font-medium ml-1">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 mb-8 px-2">
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Unlimited products</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Unlimited locations</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>White-label solution</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>24/7 dedicated support</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-center text-slate-600 group-hover:text-slate-800 transition-colors duration-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    <span>Advanced security</span>
                  </li>
                </ul>
                <Link href="/signup" className="block w-full">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-blue-500/25" size="lg">
                    Contact Sales
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-slate-600 mb-2 font-medium">All plans include 14-day free trial • No setup fees • Cancel anytime</p>
            <p className="text-sm text-slate-500">Need a custom plan? <Link href="#contact" className="text-purple-600 hover:text-purple-700 font-semibold hover:underline transition-colors duration-300">Contact our sales team</Link></p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 relative z-10 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-800 mb-6 leading-tight">
                Built by Entrepreneurs, for Entrepreneurs
              </h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                InventryPro was born from the frustration of managing inventory across multiple locations
                with outdated, clunky systems. We understand the challenges of modern business operations
                and built a solution that actually works.
              </p>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Our team of experienced developers and business owners has created a platform that
                combines powerful functionality with intuitive design. We're committed to helping
                businesses of all sizes streamline their operations and grow faster.
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="group bg-slate-50 p-4 rounded-2xl border border-gray-100 hover:border-purple-200 transition-colors">
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-1">5+</div>
                  <div className="text-slate-600 font-medium group-hover:text-purple-600 transition-colors duration-300">Years Experience</div>
                </div>
                <div className="group bg-slate-50 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-1">50+</div>
                  <div className="text-slate-600 font-medium group-hover:text-blue-600 transition-colors duration-300">Team Members</div>
                </div>
                <div className="group bg-slate-50 p-4 rounded-2xl border border-gray-100 hover:border-cyan-200 transition-colors">
                  <div className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-green-600 bg-clip-text text-transparent mb-1">15+</div>
                  <div className="text-slate-600 font-medium group-hover:text-cyan-600 transition-colors duration-300">Countries Served</div>
                </div>
                <div className="group bg-slate-50 p-4 rounded-2xl border border-gray-100 hover:border-green-200 transition-colors">
                  <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-purple-600 bg-clip-text text-transparent mb-1">99%</div>
                  <div className="text-slate-600 font-medium group-hover:text-green-600 transition-colors duration-300">Customer Satisfaction</div>
                </div>
              </div>
            </div>

            <div className="relative h-full flex items-center">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl p-10 text-white hover:-translate-y-2 transition-transform duration-500 shadow-2xl shadow-purple-500/20 w-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                <h3 className="text-3xl font-bold mb-6 relative z-10">Our Mission</h3>
                <p className="text-lg mb-8 text-blue-50 leading-relaxed relative z-10">
                  To empower businesses with intelligent inventory management tools that drive growth,
                  reduce costs, and improve customer satisfaction.
                </p>
                <div className="flex items-center space-x-5 group relative z-10 bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm">
                  <div className="w-14 h-14 bg-white text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Users className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">Customer-First Approach</div>
                    <div className="text-blue-100">Your success is our success</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-slate-50 border-t border-gray-200 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-800 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              Join thousands of satisfied customers who have transformed their business operations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border border-gray-200 bg-white hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-500/10 group">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                <p className="text-slate-600 mb-8 italic text-lg leading-relaxed">
                  "InventryPro has revolutionized how we manage our inventory. The multi-shop feature
                  is a game-changer for our business."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4 group-hover:rotate-12 transition-transform duration-300">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-purple-600 transition-colors duration-300">Rajesh Kumar</div>
                    <div className="text-sm text-slate-500 font-medium">CEO, Kumar Hardware</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 bg-white hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-blue-500/10 group">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                <p className="text-slate-600 mb-8 italic text-lg leading-relaxed">
                  "The analytics dashboard gives us insights we never had before. Our inventory
                  turnover has improved by 40% since using InventryPro."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4 group-hover:rotate-12 transition-transform duration-300">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors duration-300">Priya Sharma</div>
                    <div className="text-sm text-slate-500 font-medium">Operations Manager, Sharma Electronics</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 bg-white hover:bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-cyan-500/10 group">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current group-hover:scale-110 transition-transform duration-300" style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                <p className="text-slate-600 mb-8 italic text-lg leading-relaxed">
                  "Customer support is outstanding. They helped us migrate from our old system
                  seamlessly. Highly recommended!"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mr-4 group-hover:rotate-12 transition-transform duration-300">
                    <HeadphonesIcon className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-cyan-600 transition-colors duration-300">Amit Patel</div>
                    <div className="text-sm text-slate-500 font-medium">Owner, Patel Construction</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]"></div>

        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of businesses already using InventryPro to streamline their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-6 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-white/25 group">
                <Rocket className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                Start Your Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-6 hover:scale-105 transition-all duration-300 backdrop-blur-sm">
              Schedule Demo
            </Button>
          </div>
          <p className="text-blue-100 mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center space-x-2 mb-6 group">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-md">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors duration-300">InventryPro</span>
              </div>
              <p className="text-slate-400 mb-6 leading-relaxed">
                The most powerful inventory management system for modern businesses. Simplify your stock, scale your success.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-6 text-white tracking-wide">Product</h3>
              <ul className="space-y-3 font-medium">
                <li><Link href="#features" className="hover:text-purple-400 transition-colors duration-300">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-purple-400 transition-colors duration-300">Pricing</Link></li>
                <li><Link href="#" className="hover:text-purple-400 transition-colors duration-300">Integrations</Link></li>
                <li><Link href="#" className="hover:text-purple-400 transition-colors duration-300">API Documentation</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-6 text-white tracking-wide">Company</h3>
              <ul className="space-y-3 font-medium">
                <li><Link href="#about" className="hover:text-blue-400 transition-colors duration-300">About Us</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors duration-300">Blog</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors duration-300">Careers</Link></li>
                <li><Link href="#" className="hover:text-blue-400 transition-colors duration-300">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-6 text-white tracking-wide">Support</h3>
              <ul className="space-y-3 font-medium">
                <li><Link href="#" className="hover:text-cyan-400 transition-colors duration-300">Help Center</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors duration-300">Community Forum</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors duration-300">System Status</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors duration-300">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-slate-500 font-medium">
            <p>&copy; 2024 InventryPro. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="hover:text-white transition-colors duration-300">Terms</Link>
              <Link href="#" className="hover:text-white transition-colors duration-300">Privacy</Link>
              <Link href="#" className="hover:text-white transition-colors duration-300">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
