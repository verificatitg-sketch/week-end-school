import { NextResponse } from 'next/server';
import { turso, db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST() {
  try {
    // Create roles
    const roleNames = [
      'SUPER_ADMIN',
      'ADMIN',
      'MODERATEUR',
      'FORMATEUR',
      'MENTOR',
      'VOLONTAIRE',
      'UTILISATEUR',
      'INTERVENANT_URGENCE',
    ];

    const roles: Record<string, string> = {};
    for (const name of roleNames) {
      // Check if role exists
      const existing = await turso.role.findUnique({ name });
      if (existing) {
        roles[name] = existing.id;
      } else {
        const newRole = await turso.role.create({ name, description: `Role: ${name}` });
        if (newRole) {
          roles[name] = newRole.id;
        }
      }
    }

    // Create super admin user
    const superAdminPassword = await hashPassword('admin123');
    const existingAdmin = await turso.user.findUnique({ email: 'blunaantoine@gmail.com' });

    let adminId: string;
    if (existingAdmin) {
      adminId = existingAdmin.id;
      await turso.user.update({ id: adminId }, { role_id: roles.SUPER_ADMIN, is_verified: 1 });
    } else {
      adminId = await turso.insert('users', {
        email: 'blunaantoine@gmail.com',
        name: 'Admin WEDS',
        password: superAdminPassword,
        phone: '+228 91 91 91 91',
        location: 'Lomé, Togo',
        role_id: roles.SUPER_ADMIN,
        is_verified: 1,
      });
    }

    // Create regular user
    const userPassword = await hashPassword('user123');
    const existingUser = await turso.user.findUnique({ email: 'user@weds.togo' });

    let regularUserId: string;
    if (existingUser) {
      regularUserId = existingUser.id;
    } else {
      regularUserId = await turso.insert('users', {
        email: 'user@weds.togo',
        name: 'Ami Togo',
        password: userPassword,
        phone: '+228 91 00 00 00',
        location: 'Sokodé, Togo',
        role_id: roles.UTILISATEUR,
        is_verified: 1,
      });
    }

    // Create formateur user
    const formateurPassword = await hashPassword('formateur123');
    const existingFormateur = await turso.user.findUnique({ email: 'formateur@weds.togo' });

    let formateurId: string;
    if (existingFormateur) {
      formateurId = existingFormateur.id;
    } else {
      formateurId = await turso.insert('users', {
        email: 'formateur@weds.togo',
        name: 'Kofi Mensah',
        password: formateurPassword,
        phone: '+228 92 00 00 00',
        location: 'Kara, Togo',
        role_id: roles.FORMATEUR,
        is_verified: 1,
      });
    }

    // Create volunteer user
    const volunteerPassword = await hashPassword('volunteer123');
    const existingVolunteer = await turso.user.findUnique({ email: 'volunteer@weds.togo' });

    let volunteerId: string;
    if (existingVolunteer) {
      volunteerId = existingVolunteer.id;
    } else {
      volunteerId = await turso.insert('users', {
        email: 'volunteer@weds.togo',
        name: 'Afi Lawson',
        password: volunteerPassword,
        phone: '+228 93 00 00 00',
        location: 'Atakpamé, Togo',
        role_id: roles.VOLONTAIRE,
        is_verified: 1,
      });
    }

    // Create sample opportunities
    const opportunityData = [
      {
        title: 'Stage en Médiation Communautaire',
        description: 'Stage de 6 mois en médiation communautaire avec une ONG internationale à Lomé.',
        type: 'stage',
        organization: 'ONG Paix et Développement',
        location: 'Lomé, Togo',
        deadline: '2025-09-30',
        salary: 'Indemnité de stage',
        requirements: 'Formation en médiation ou sciences sociales',
        contact_email: 'stage@paixdev.tg',
        published: 1,
      },
      {
        title: 'Emploi: Coordinateur de Programme',
        description: 'Recherche coordinateur de programme pour la gestion des activités de formation dans la région des Plateaux.',
        type: 'emploi',
        organization: 'WEEK-END SCHOOL DIGITAL',
        location: 'Atakpamé, Togo',
        deadline: '2025-08-15',
        salary: '150 000 - 250 000 FCFA/mois',
        requirements: "Diplôme universitaire, 3 ans d'expérience en gestion de projet",
        contact_email: 'rh@weds.togo',
        published: 1,
      },
      {
        title: "Bourse d'Études en Leadership",
        description: "Bourse complète pour un programme de leadership et entrepreneuriat social au Togo.",
        type: 'bourse',
        organization: "Fondation pour l'Éducation",
        location: 'Kara, Togo',
        deadline: '2025-10-01',
        requirements: 'Être âgé de 18-35 ans, résider au Togo',
        contact_email: 'bourse@fondation.tg',
        published: 1,
      },
      {
        title: 'Volontariat: Éducation Numérique',
        description: 'Devenez volontaire pour enseigner les compétences numériques dans les communautés rurales.',
        type: 'volontariat',
        organization: 'Digital Togo',
        location: 'Sokodé, Togo',
        deadline: '2025-12-31',
        requirements: 'Connaissances en informatique, motivation et engagement',
        contact_email: 'volontaire@digitaltogo.tg',
        published: 1,
      },
    ];

    for (const data of opportunityData) {
      const existing = await turso.query(
        'SELECT id FROM opportunities WHERE title = ? LIMIT 1',
        [data.title]
      );
      if (existing.rows.length === 0) {
        await turso.insert('opportunities', data);
      }
    }

    // Create sample mentors
    const mentorUsers = [
      {
        email: 'mentor.amede@weds.togo',
        name: 'Amede Koffi',
        expertise: 'Médiation de conflits, Dialogue intercommunautaire',
        availability: 'Lundi-Vendredi, 9h-17h',
        experience: "15 ans d'expérience en médiation communautaire au Togo et en Afrique de l'Ouest",
      },
      {
        email: 'mentor.esi@weds.togo',
        name: 'Esi Agbéko',
        expertise: 'Entrepreneuriat, Gestion financière',
        availability: 'Mardi et Jeudi, 14h-18h',
        experience: 'Fondatrice de deux entreprises sociales, formatrice en entrepreneuriat',
      },
      {
        email: 'mentor.kodjo@weds.togo',
        name: 'Kodjo Adjo',
        expertise: 'Compétences numériques, Développement web',
        availability: 'Lundi-Mercredi, 10h-15h',
        experience: 'Ingénieur informatique, 8 ans dans la formation numérique',
      },
    ];

    for (const m of mentorUsers) {
      const existingMentorUser = await turso.user.findUnique({ email: m.email });

      if (!existingMentorUser) {
        const mPassword = await hashPassword('mentor123');
        const newMentorUserId = await turso.insert('users', {
          email: m.email,
          name: m.name,
          password: mPassword,
          location: 'Lomé, Togo',
          role_id: roles.MENTOR,
          is_verified: 1,
        });

        await turso.insert('mentors', {
          user_id: newMentorUserId,
          expertise: m.expertise,
          availability: m.availability,
          experience: m.experience,
          rating: 4.5 + Math.random() * 0.5,
        });
      }
    }

    // Create sample community posts
    const postData = [
      {
        title: 'Bienvenue sur la communauté WEDS!',
        content: "Nous sommes ravis de vous accueillir sur la plateforme WEEK-END SCHOOL DIGITAL. Ici, vous pouvez partager vos expériences, poser des questions, et échanger avec d'autres membres de la communauté. Ensemble, construisons la paix par l'éducation!",
        category: 'general',
        user_id: adminId,
        pinned: 1,
      },
      {
        title: 'Témoignage: Comment la médiation a sauvé mon village',
        content: "Il y a deux ans, notre village était divisé par un conflit foncier. Grâce aux techniques de médiation apprises sur WEDS, j'ai pu faciliter le dialogue entre les parties. Aujourd'hui, nous vivons en paix et collaborons même sur des projets agricoles communs.",
        category: 'temoignage',
        user_id: regularUserId,
        pinned: 0,
      },
      {
        title: 'Conseils pour réussir votre formation en ligne',
        content: "Voici quelques conseils pour tirer le meilleur parti de vos cours sur WEDS:\n1. Fixez un horaire régulier d'étude\n2. Participez aux discussions communautaires\n3. N'hésitez pas à demander de l'aide aux mentors\n4. Appliquez ce que vous apprenez dans votre quotidien\n5. Célébrez vos progrès!",
        category: 'conseil',
        user_id: formateurId,
        pinned: 0,
      },
    ];

    for (const data of postData) {
      if (!data.user_id) continue;
      const existing = await turso.query(
        'SELECT id FROM community_posts WHERE title = ? LIMIT 1',
        [data.title]
      );
      if (existing.rows.length === 0) {
        await turso.insert('community_posts', data);
      }
    }

    // Create sample groups
    const groupData = [
      { name: 'Médiateurs Communautaires', description: 'Groupe des médiateurs certifiés', category: 'paix', icon: '🕊️' },
      { name: 'Entrepreneurs Togo', description: 'Réseau des entrepreneurs formés sur WEDS', category: 'entrepreneuriat', icon: '💼' },
      { name: 'Volontaires Numériques', description: 'Communauté des volontaires en éducation numérique', category: 'numerique', icon: '💻' },
      { name: 'Jeunes Leaders', description: 'Groupe des jeunes leaders communautaires', category: 'leadership', icon: '🌟' },
    ];

    for (const data of groupData) {
      const existingGroup = await turso.query(
        'SELECT id FROM groups WHERE name = ? LIMIT 1',
        [data.name]
      );

      if (existingGroup.rows.length === 0) {
        const groupId = await turso.insert('groups', data);

        // Add admin and regular user to groups
        if (adminId) {
          await turso.insert('group_members', { user_id: adminId, group_id: groupId, role: 'admin' });
        }
        if (regularUserId) {
          await turso.insert('group_members', { user_id: regularUserId, group_id: groupId, role: 'member' });
        }
      }
    }

    // Create badges
    const badgeData = [
      { name: 'Pionnier de la Paix', description: 'Premier cours de médiation complété', icon: '🕊️', category: 'paix' },
      { name: 'Apprenant Dédié', description: '5 cours complétés', icon: '📚', category: 'apprentissage' },
      { name: 'Mentor Bienveillant', description: 'Aide 10 apprenants', icon: '🤝', category: 'mentorat' },
      { name: 'Citoyen Actif', description: '10 signalements communautaires', icon: '🏘️', category: 'communaute' },
      { name: "Héros d'Urgence", description: 'Première intervention SOS', icon: '🦸', category: 'urgence' },
      { name: 'Expert Numérique', description: 'Cours de compétences numériques complété', icon: '💻', category: 'numerique' },
      { name: 'Entrepreneur Social', description: 'Formation en entrepreneuriat complétée', icon: '💡', category: 'entrepreneuriat' },
      { name: 'Ambassadeur WEDS', description: 'Parrainage de 5 nouveaux membres', icon: '⭐', category: 'communaute' },
    ];

    for (const data of badgeData) {
      const existingBadge = await turso.query(
        'SELECT id FROM badges WHERE name = ? LIMIT 1',
        [data.name]
      );
      if (existingBadge.rows.length === 0) {
        await turso.insert('badges', data);
      }
    }

    // Create some notifications for the regular user
    if (regularUserId) {
      const notifData = [
        {
          user_id: regularUserId,
          title: 'Bienvenue sur WEDS!',
          message: 'Votre compte a été créé avec succès. Explorez les cours et opportunités disponibles.',
          type: 'system',
        },
        {
          user_id: regularUserId,
          title: 'Nouveau cours disponible',
          message: 'Un nouveau cours "Médiation et Résolution de Conflits" est maintenant disponible.',
          type: 'course',
          link: '/courses',
        },
        {
          user_id: regularUserId,
          title: 'Opportunité de bourse',
          message: "Une nouvelle bourse d'études en leadership est disponible. Postulez avant le 1er octobre!",
          type: 'opportunity',
          link: '/opportunities',
        },
      ];
      for (const data of notifData) {
        await turso.insert('notifications', data);
      }
    }

    return NextResponse.json({
      message: 'Database seeded successfully (Turso)',
      data: {
        roles: roleNames.length,
        users: 4,
        courses: 0,
        opportunities: opportunityData.length,
        mentors: mentorUsers.length,
        posts: postData.filter(p => p.user_id).length,
        groups: groupData.length,
        badges: badgeData.length,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
